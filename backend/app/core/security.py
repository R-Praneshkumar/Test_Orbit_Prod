"""
Security utilities: JWT auth, SSRF validation, security headers, secret masking.
"""
import ipaddress
import logging
import re
from urllib.parse import urlparse
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import jwt

logger = logging.getLogger(__name__)


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
        if isinstance(record.msg, str):
            record.msg = self._mask(record.msg)
        if record.args:
            record.args = tuple(
                self._mask(a) if isinstance(a, str) else a
                for a in record.args
            )
        return True

    @staticmethod
    def _mask(text: str) -> str:
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


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> dict:
    """
    FastAPI dependency that validates a Supabase JWT from the Authorization header.

    - When REQUIRE_AUTH=True (production): rejects requests without a valid token.
    - When REQUIRE_AUTH=False (development): allows unauthenticated requests through,
      returning a stub user dict so endpoints can still reference `user["sub"]` etc.
    """
    from app.core.config import get_settings
    settings = get_settings()

    # If auth is not required (dev mode), allow through with optional token
    if not settings.REQUIRE_AUTH:
        if not credentials:
            return {"sub": "anonymous", "email": "dev@localhost", "role": "authenticated"}
        # Still try to validate if a token is provided (helpful for testing)
        try:
            return _decode_token(credentials.credentials, settings.SUPABASE_JWT_SECRET)
        except Exception:
            # In dev mode, don't block on invalid tokens
            return {"sub": "anonymous", "email": "dev@localhost", "role": "authenticated"}

    # Production: token is required
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    if not settings.SUPABASE_JWT_SECRET:
        logger.error("SUPABASE_JWT_SECRET is not configured but REQUIRE_AUTH=True")
        raise HTTPException(status_code=500, detail="Server auth configuration error")

    return _decode_token(credentials.credentials, settings.SUPABASE_JWT_SECRET)


def _decode_token(token: str, secret: str) -> dict:
    """Decode and validate a Supabase JWT. Returns the payload dict."""
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
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


def validate_proxy_url(url: str) -> None:
    """
    Validate a URL for the proxy endpoint.
    Raises HTTPException(400) if the URL is blocked.
    """
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

    # Block known dangerous hostnames
    if hostname.lower() in BLOCKED_HOSTNAMES:
        raise HTTPException(status_code=400, detail=f"Hostname '{hostname}' is not allowed")

    # Resolve hostname to IP and check against blocked ranges
    try:
        import socket
        addr_info = socket.getaddrinfo(hostname, None)
        for _, _, _, _, sockaddr in addr_info:
            ip = ipaddress.ip_address(sockaddr[0])
            for network in BLOCKED_NETWORKS:
                if ip in network:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Target address resolves to a blocked IP range"
                    )
    except HTTPException:
        raise
    except Exception:
        # If DNS resolution fails, let it through (aiohttp will handle the error)
        pass


# --- Security Headers Middleware ---

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
