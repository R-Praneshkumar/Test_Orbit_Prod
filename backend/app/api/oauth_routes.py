from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
import aiohttp
import hashlib
import hmac as hmac_module
import logging
import time
import uuid
import secrets
from app.api.routes import limiter
from app.core.config import get_settings
from app.core.security import verify_token, validate_proxy_url, PinnedResolver, read_bounded_response

router = APIRouter()
logger = logging.getLogger(__name__)
_settings = get_settings()

# --- OAuth State Token (CSRF Protection) ---
# State tokens expire after 10 minutes
_OAUTH_STATE_TTL = 600
_OAUTH_PROCESS_SECRET = secrets.token_bytes(32)


def _get_state_secret() -> bytes:
    """Get the HMAC signing key for OAuth state tokens."""
    secret = _settings.OAUTH_STATE_SECRET or _settings.SUPABASE_JWT_SECRET
    return secret.encode() if secret else _OAUTH_PROCESS_SECRET


def generate_oauth_state() -> str:
    """Generate a signed, time-limited OAuth state token (stateless HMAC approach)."""
    nonce = uuid.uuid4().hex
    ts = str(int(time.time()))
    payload = f"{nonce}:{ts}"
    sig = hmac_module.new(_get_state_secret(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def validate_oauth_state(state: str) -> bool:
    """Validate an OAuth state token's HMAC signature and expiration."""
    if not state:
        return False
    parts = state.split(":")
    if len(parts) != 3:
        return False
    nonce, ts, sig = parts

    # Verify HMAC signature (constant-time comparison)
    payload = f"{nonce}:{ts}"
    expected_sig = hmac_module.new(_get_state_secret(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac_module.compare_digest(sig, expected_sig):
        return False

    # Verify not expired
    try:
        age = time.time() - int(ts)
        if age < 0 or age > _OAUTH_STATE_TTL:
            return False
    except (ValueError, OverflowError):
        return False

    return True


class TokenRequest(BaseModel):
    """Request to exchange an auth code or client credentials for an access token."""
    grant_type: str  # "authorization_code" or "client_credentials"
    token_url: str
    client_id: str
    client_secret: str = ""
    code: Optional[str] = None  # Required for authorization_code
    redirect_uri: Optional[str] = None  # Required for authorization_code
    scope: Optional[str] = None
    state: Optional[str] = None  # CSRF protection for authorization_code grant


class RefreshRequest(BaseModel):
    """Request to refresh an expired access token."""
    token_url: str
    client_id: str
    client_secret: str = ""
    refresh_token: str


@router.get("/oauth/state")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def get_oauth_state(request: Request, user: dict = Depends(verify_token)):
    """Generate a signed OAuth state token for CSRF protection in authorization flows."""
    return {"state": generate_oauth_state()}


@router.post("/oauth/token")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def exchange_token(request: Request, req: TokenRequest, user: dict = Depends(verify_token)):
    """
    Proxies the OAuth 2.0 token exchange request to the provider.
    This avoids CORS issues and keeps client_secret off the frontend.
    """
    is_production = _settings.ENV != "development"

    try:
        data = {
            "grant_type": req.grant_type,
            "client_id": req.client_id,
        }

        if req.client_secret:
            data["client_secret"] = req.client_secret

        if req.grant_type == "authorization_code":
            if not req.code:
                raise HTTPException(status_code=400, detail="Authorization code is required for authorization_code grant")

            # CSRF protection: validate OAuth state parameter
            if req.state:
                if not validate_oauth_state(req.state):
                    raise HTTPException(status_code=400, detail="Invalid or expired OAuth state parameter")
            elif is_production:
                raise HTTPException(status_code=400, detail="OAuth state parameter is required")

            data["code"] = req.code
            if req.redirect_uri:
                data["redirect_uri"] = req.redirect_uri
        
        if req.scope:
            data["scope"] = req.scope

        logger.info(f"OAuth token exchange: {req.grant_type} → {req.token_url}")

        # SSRF protection: validate the token URL and pin DNS to the resolved IPs
        hostname, resolved_addrs = await validate_proxy_url(req.token_url)

        timeout = aiohttp.ClientTimeout(total=15)
        # Pin DNS to the pre-resolved IPs to prevent DNS rebinding (TOCTOU)
        connector = aiohttp.TCPConnector(resolver=PinnedResolver(hostname, resolved_addrs))
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            async with session.post(
                req.token_url,
                data=data,
                headers={"Accept": "application/json"},
                allow_redirects=False
            ) as response:
                response_text = (await read_bounded_response(response, 1_048_576)).decode("utf-8", errors="replace")

                # Try to parse as JSON
                try:
                    import json
                    result = json.loads(response_text)
                except Exception:
                    result = {"raw_response": response_text}

                if response.status != 200:
                    logger.error(f"OAuth token exchange failed: status {response.status}")
                    return {
                        "error": result.get("error", "token_exchange_failed"),
                        "error_description": result.get("error_description", f"Provider returned status {response.status}"),
                        "status": response.status,
                    }

                logger.info("OAuth token exchange successful")
                return {
                    "access_token": result.get("access_token"),
                    "token_type": result.get("token_type", "Bearer"),
                    "expires_in": result.get("expires_in"),
                    "refresh_token": result.get("refresh_token"),
                    "scope": result.get("scope"),
                }

    except aiohttp.ClientError as e:
        logger.error(f"OAuth network error: {e}")
        raise HTTPException(status_code=502, detail="Failed to reach token endpoint")
    except Exception as e:
        logger.error(f"OAuth error: {e}")
        raise HTTPException(status_code=500, detail="OAuth token exchange failed")


@router.post("/oauth/refresh")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def refresh_token(request: Request, req: RefreshRequest, user: dict = Depends(verify_token)):
    """
    Refreshes an expired access token using a refresh token.
    """
    try:
        data = {
            "grant_type": "refresh_token",
            "client_id": req.client_id,
            "refresh_token": req.refresh_token,
        }

        if req.client_secret:
            data["client_secret"] = req.client_secret

        logger.info(f"OAuth token refresh → {req.token_url}")

        # SSRF protection: validate the token URL and pin DNS to the resolved IPs
        hostname, resolved_addrs = await validate_proxy_url(req.token_url)

        timeout = aiohttp.ClientTimeout(total=15)
        # Pin DNS to the pre-resolved IPs to prevent DNS rebinding (TOCTOU)
        connector = aiohttp.TCPConnector(resolver=PinnedResolver(hostname, resolved_addrs))
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            async with session.post(
                req.token_url,
                data=data,
                headers={"Accept": "application/json"},
                allow_redirects=False
            ) as response:
                response_text = (await read_bounded_response(response, 1_048_576)).decode("utf-8", errors="replace")

                try:
                    import json
                    result = json.loads(response_text)
                except Exception:
                    result = {"raw_response": response_text}

                if response.status != 200:
                    logger.error(f"OAuth refresh failed: {response.status}")
                    return {
                        "error": result.get("error", "refresh_failed"),
                        "error_description": result.get("error_description", f"Provider returned status {response.status}"),
                        "status": response.status,
                    }

                return {
                    "access_token": result.get("access_token"),
                    "token_type": result.get("token_type", "Bearer"),
                    "expires_in": result.get("expires_in"),
                    "refresh_token": result.get("refresh_token", req.refresh_token),
                    "scope": result.get("scope"),
                }

    except aiohttp.ClientError as e:
        logger.error(f"OAuth refresh network error: {e}")
        raise HTTPException(status_code=502, detail="Failed to reach token endpoint")
    except Exception as e:
        logger.error(f"OAuth refresh error: {e}")
        raise HTTPException(status_code=500, detail="OAuth token refresh failed")
