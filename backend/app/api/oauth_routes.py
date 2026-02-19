from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
import aiohttp
import logging
from app.api.routes import limiter
from app.core.config import get_settings
from app.core.security import verify_token, validate_proxy_url

router = APIRouter()
logger = logging.getLogger(__name__)
_settings = get_settings()


class TokenRequest(BaseModel):
    """Request to exchange an auth code or client credentials for an access token."""
    grant_type: str  # "authorization_code" or "client_credentials"
    token_url: str
    client_id: str
    client_secret: str = ""
    code: Optional[str] = None  # Required for authorization_code
    redirect_uri: Optional[str] = None  # Required for authorization_code
    scope: Optional[str] = None


class RefreshRequest(BaseModel):
    """Request to refresh an expired access token."""
    token_url: str
    client_id: str
    client_secret: str = ""
    refresh_token: str


@router.post("/oauth/token")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def exchange_token(request: Request, req: TokenRequest, user: dict = Depends(verify_token)):
    """
    Proxies the OAuth 2.0 token exchange request to the provider.
    This avoids CORS issues and keeps client_secret off the frontend.
    """
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
            data["code"] = req.code
            if req.redirect_uri:
                data["redirect_uri"] = req.redirect_uri
        
        if req.scope:
            data["scope"] = req.scope

        logger.info(f"OAuth token exchange: {req.grant_type} → {req.token_url}")

        # SSRF protection: validate the token URL
        validate_proxy_url(req.token_url)

        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                req.token_url,
                data=data,
                headers={"Accept": "application/json"}
            ) as response:
                response_text = await response.text()
                
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

        # SSRF protection: validate the token URL
        validate_proxy_url(req.token_url)

        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                req.token_url,
                data=data,
                headers={"Accept": "application/json"}
            ) as response:
                response_text = await response.text()
                
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
