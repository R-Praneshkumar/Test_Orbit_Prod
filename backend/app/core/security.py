"""
Security utilities: JWT auth, SSRF validation, security headers, secret masking.
"""
import asyncio
import ipaddress
import json
import logging
import re
import socket as socket_module
import time
from contextlib import asynccontextmanager
from urllib.parse import urlparse
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import jwt

logger = logging.getLogger(__name__)

# --- JWKS cache (avoids fetching on every request) ---
_jwks_cache: dict = {}   # keyed by jwks_url → {"keys": [...], "fetched_at": timestamp}
_JWKS_TTL = 3600  # 1 hour


# --- Secret Masking Log Filter ---

# Patterns that look like secrets (API keys, tokens, passwords, JWTs)
_SECRET_PATTERNS = [
    # Generic API keys / tokens (long alphanumeric strings)
    re.compile(r'((?:key|token|secret|password|authorization|bearer)\s*[=:]\s*)["\']?([A-Za-z0-9_\-\.]{20,})["\']?', re.IGNORECASE),
    # JWTs (eyJ...)
    re.compile(r'(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})'),
    # Gemini API key pattern (AIza...)
    re.compile(r'(AIza[A-Za-z0-9_\-]{30,})'),
]


class SecretMaskingFilter(logging.Filter):
    """Logging filter that masks secrets in log messages."""

    def filter(self, record):
        # Format first: mapping arguments and nested objects can contain secrets.
        record.msg = self._mask(record.getMessage())
        record.args = ()
        return True

    @staticmethod
    def _mask(text: str) -> str:
        text = re.sub(r'(?i)(bearer\s+)[^\s\"\',;]+', r'\1***MASKED***', text)
        text = re.sub(
            r'(?i)((?:[\w-]*(?:key|token|secret|password|authorization)[\w-]*)[\"\']?\s*[:=]\s*[\"\']?)([^\s\"\'&,;}]+)',
            r'\1***MASKED***', text,
        )
        text = re.sub(r'(?i)([a-z][a-z0-9+.-]*://)[^\s/@]+:[^\s/@]+@', r'\1***MASKED***@', text)
        for pattern in _SECRET_PATTERNS:
            text = pattern.sub(lambda m: m.group(0)[:8] + '***MASKED***' if m.lastindex is None or m.lastindex < 2 else m.group(1) + '***MASKED***', text)
        return text


def install_secret_masking():
    """Install the secret masking filter on the root logger."""
    root_logger = logging.getLogger()
    root_logger.addFilter(SecretMaskingFilter())


# --- HTTPS Redirect Middleware ---

class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """Redirects HTTP to HTTPS in production. Respects X-Forwarded-Proto from reverse proxies."""

    async def dispatch(self, request: Request, call_next) -> Response:
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        if proto == "http":
            url = request.url.replace(scheme="https")
            return Response(status_code=307, headers={"Location": str(url)})
        return await call_next(request)


# --- JWT Authentication ---

_bearer_scheme = HTTPBearer(auto_error=False)

_ANON_USER = {"sub": "anonymous", "email": "dev@localhost", "role": "authenticated"}


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> dict:
    """
    FastAPI dependency that validates a Supabase JWT from the Authorization header.
    Supports HS256 (legacy), RS256, and ES256 (newer Supabase projects via JWKS).

    - When REQUIRE_AUTH=True (production): rejects requests without a valid token.
    - When REQUIRE_AUTH=False (development): allows unauthenticated requests through.
    """
    from app.core.config import get_settings
    settings = get_settings()

    if not settings.REQUIRE_AUTH:
        if not credentials:
            return _ANON_USER
        try:
            return await _decode_token_auto(credentials.credentials, settings)
        except Exception:
            return _ANON_USER

    # Production: token is required
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    return await _decode_token_auto(credentials.credentials, settings)


async def _decode_token_auto(token: str, settings) -> dict:
    """
    Auto-detect the JWT algorithm from the token header and verify accordingly:
    - HS256: verify with SUPABASE_JWT_SECRET
    - ES256 / RS256: verify with public key fetched from Supabase JWKS endpoint
    """
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token format: {str(e)}")

    alg = header.get("alg", "HS256")
    if alg not in {"HS256", "ES256", "RS256"}:
        raise HTTPException(status_code=401, detail="Unsupported JWT algorithm")

    if alg == "HS256":
        if not settings.SUPABASE_JWT_SECRET:
            raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET not configured for HS256 token")
        issuer = settings.SUPABASE_URL.rstrip("/") + "/auth/v1" if settings.SUPABASE_URL else None
        return _decode_hs256(token, settings.SUPABASE_JWT_SECRET, issuer)
    else:
        # ES256 or RS256 — use JWKS
        return await _decode_jwks(token, header, alg, settings)


def _decode_hs256(token: str, secret: str, issuer: str | None = None) -> dict:
    """Decode and validate a Supabase HS256 JWT using the shared secret."""
    try:
        return jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated",
                          issuer=issuer, options={"require": ["exp", "sub", "aud"]})
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Invalid token audience")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


async def _fetch_jwks(jwks_url: str) -> list:
    """Fetch and cache the JWKS from the given URL. Caches for 1 hour."""
    now = time.time()
    cached = _jwks_cache.get(jwks_url)
    if cached and now - cached["fetched_at"] < _JWKS_TTL:
        return cached["keys"]

    import aiohttp
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(jwks_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    raise HTTPException(status_code=500, detail="Failed to fetch Supabase JWKS")
                data = await resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"JWKS fetch error: {str(e)}")

    keys = data.get("keys", [])
    _jwks_cache[jwks_url] = {"keys": keys, "fetched_at": now}
    return keys


async def _decode_jwks(token: str, header: dict, alg: str, settings) -> dict:
    """Verify an ES256/RS256 JWT using the Supabase JWKS public key."""
    # SECURITY: Always derive JWKS URL from the trusted SUPABASE_URL config.
    # Never use the token's iss claim — an attacker could forge a token pointing
    # to their own JWKS endpoint, enabling complete token forgery.
    supabase_url = settings.SUPABASE_URL.rstrip("/") if settings.SUPABASE_URL else None

    if not supabase_url:
        raise HTTPException(
            status_code=401,
            detail="SUPABASE_URL not configured. Cannot verify asymmetric JWT."
        )

    jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    keys = await _fetch_jwks(jwks_url)

    # Find the matching key by kid
    kid = header.get("kid")
    key_data = None
    for k in keys:
        if not kid or k.get("kid") == kid:
            key_data = k
            break

    if not key_data:
        raise HTTPException(status_code=401, detail="No matching public key found in JWKS")

    # Convert JWK → public key using PyJWT's algorithm classes
    try:
        if alg == "ES256":
            from jwt.algorithms import ECAlgorithm
            public_key = ECAlgorithm.from_jwk(json.dumps(key_data))
        elif alg in ("RS256", "RS384", "RS512"):
            from jwt.algorithms import RSAAlgorithm
            public_key = RSAAlgorithm.from_jwk(json.dumps(key_data))
        else:
            raise HTTPException(status_code=401, detail=f"Unsupported JWT algorithm: {alg}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Failed to load public key: {str(e)}")

    try:
        return jwt.decode(token, public_key, algorithms=[alg], audience="authenticated",
                          issuer=f"{supabase_url}/auth/v1",
                          options={"require": ["exp", "sub", "aud", "iss"]})
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Invalid token audience")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


# --- SSRF Protection ---

# Blocked IP ranges (private, loopback, link-local, cloud metadata)
BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local + cloud metadata
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::1/128"),          # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),         # IPv6 private
    ipaddress.ip_network("fe80::/10"),        # IPv6 link-local
]

BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
}


class PinnedResolver:
    """
    DNS resolver that returns pre-resolved addresses to prevent DNS rebinding.
    Used by the proxy endpoint to ensure the connection goes to the same IP
    that was validated by validate_proxy_url(), closing the TOCTOU gap.
    """

    def __init__(self, hostname: str, resolved_addrs: list):
        self._hostname = hostname
        self._resolved_addrs = resolved_addrs

    async def resolve(self, host: str, port: int = 0, family: int = socket_module.AF_INET):
        if host == self._hostname:
            results = []
            for ip_str, addr_family in self._resolved_addrs:
                if family != socket_module.AF_UNSPEC and family != 0 and addr_family != family:
                    continue
                results.append({
                    "hostname": host,
                    "host": ip_str,
                    "port": port,
                    "family": addr_family,
                    "proto": 0,
                    "flags": socket_module.AI_NUMERICHOST,
                })
            if results:
                return results
        raise OSError(f"No pre-resolved addresses for {host}")

    async def close(self):
        pass


async def validate_proxy_url(url: str) -> tuple:
    """
    Validate a URL for the proxy endpoint.
    Returns (hostname, resolved_addrs) where resolved_addrs is a list of
    (ip_str, family) tuples for use with PinnedResolver.
    Raises HTTPException(400) if the URL is blocked.

    In development mode (ENV != "production"), localhost and private IPs are
    allowed so developers can test against local APIs.  In production, all
    private/loopback addresses are blocked to prevent SSRF.
    """
    from app.core.config import get_settings
    is_production = get_settings().ENV != "development"

    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL format")

    # Only allow http(s)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail=f"Scheme '{parsed.scheme}' not allowed. Only http/https.")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="URL must include a hostname")

    # Block known dangerous hostnames (always block cloud metadata, only block localhost in production)
    if hostname.lower() == "metadata.google.internal":
        raise HTTPException(status_code=400, detail=f"Hostname '{hostname}' is not allowed")
    if is_production and hostname.lower() in BLOCKED_HOSTNAMES:
        raise HTTPException(status_code=400, detail=f"Hostname '{hostname}' is not allowed")

    # Resolve hostname to IP and check against blocked ranges.
    # The resolved addresses are returned so the proxy can pin the connection
    # to these exact IPs, preventing DNS rebinding (TOCTOU) attacks.
    try:
        loop = asyncio.get_event_loop()
        addr_info = await loop.run_in_executor(
            None, socket_module.getaddrinfo, hostname, None
        )
        resolved_addrs = []
        for family, _, _, _, sockaddr in addr_info:
            ip = ipaddress.ip_address(sockaddr[0])
            if is_production:
                # Include IPv4-mapped IPv6, reserved, multicast and shared ranges.
                effective_ip = getattr(ip, "ipv4_mapped", None) or ip
                if not effective_ip.is_global or effective_ip.is_multicast:
                    raise HTTPException(status_code=400, detail="Target address is not a public IP")
                for network in BLOCKED_NETWORKS:
                    if ip in network:
                        raise HTTPException(
                            status_code=400,
                            detail="Target address resolves to a blocked IP range"
                        )
            resolved_addrs.append((sockaddr[0], family))

        if not resolved_addrs:
            raise HTTPException(status_code=400, detail="Hostname resolved to no addresses")

        return hostname, resolved_addrs
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"DNS resolution failed for {hostname}: {e}")
        raise HTTPException(
            status_code=400,
            detail="Could not resolve hostname. DNS lookup failed."
        )


# --- Security Headers Middleware ---

async def read_bounded_response(response, limit: int = 10_485_760) -> bytes:
    """Limit decompressed response bytes before they can exhaust server memory."""
    chunks = []
    size = 0
    async for chunk in response.content.iter_chunked(65_536):
        size += len(chunk)
        if size > limit:
            raise HTTPException(status_code=502, detail="Upstream response exceeds size limit")
        chunks.append(chunk)
    return b"".join(chunks)


@asynccontextmanager
async def safe_request(method: str, url: str, **kwargs):
    """Make one request to validated, pinned addresses without redirects."""
    import aiohttp
    hostname, addresses = await validate_proxy_url(url)
    connector = aiohttp.TCPConnector(resolver=PinnedResolver(hostname, addresses))
    async with aiohttp.ClientSession(connector=connector) as session:
        async with session.request(method, url, allow_redirects=False, **kwargs) as response:
            yield response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds standard security headers to all responses."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'wasm-unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "object-src 'none'; "
            "base-uri 'self'"
        )
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        # HSTS only in production (requires HTTPS)
        from app.core.config import get_settings
        if get_settings().ENV == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response
