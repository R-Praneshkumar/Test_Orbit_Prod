from fastapi import APIRouter, Request, HTTPException, Depends
from app.services.mock_service import mock_service
from app.services.ai_service import ai_service
from app.api.routes import limiter
from app.core.config import get_settings
from app.core.security import verify_token
import logging

router = APIRouter()
logger = logging.getLogger(__name__)
_settings = get_settings()


@router.get("/")
@limiter.limit(_settings.MOCK_RATE_LIMIT)
async def list_mocks(request: Request, _user: dict = Depends(verify_token)):
    """List all registered mocks with metadata. Requires authentication."""
    return {
        "mocks": mock_service.list_mocks(),
        "count": len(mock_service.list_mocks()),
    }


@router.delete("/")
@limiter.limit(_settings.MOCK_RATE_LIMIT)
async def clear_mocks(request: Request, _user: dict = Depends(verify_token)):
    """Clear all mocks and delete the persistence file. Requires authentication."""
    mock_service.clear_mocks()
    return {"status": "cleared"}


@router.delete("/_admin/{path:path}")
async def delete_mock(path: str, request: Request, _user: dict = Depends(verify_token)):
    """Delete a single mock by method + path (admin endpoint). Requires authentication."""
    method = request.query_params.get("method", "GET").upper()
    deleted = mock_service.delete_mock(method, path)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"No mock found for {method} /{path}")
    return {"status": "deleted", "method": method, "path": path}


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
@limiter.limit(_settings.MOCK_RATE_LIMIT)
async def handle_mock_request(request: Request, path: str):
    """Catch-all: serve cached mock or generate a new one with AI."""
    method = request.method
    logger.info(f"Mock Request: {method} /{path}")

    mock_data = mock_service.get_mock(method, path)
    if mock_data:
        logger.info("Serving cached mock")
        return mock_data

    logger.info("Generating new mock with AI...")
    try:
        generated_mock = await ai_service.generate_mock_response(method, path)
        if "error" in generated_mock and generated_mock.get("error"):
            raise HTTPException(status_code=500, detail=generated_mock["error"])
        mock_service.add_mock(method, path, generated_mock)
        return generated_mock
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Mock generation error: {e}")
        raise HTTPException(status_code=500, detail="Mock generation failed")
