from fastapi import APIRouter, HTTPException, Request
from app.services.mock_service import mock_service
from app.services.ai_service import ai_service
from typing import Any, Dict
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/list")
async def list_mocks():
    """List all currently active mock endpoints."""
    return mock_service.list_mocks()

@router.delete("/clear")
async def clear_mocks():
    """Clear all active mocks."""
    mock_service.clear_mocks()
    return {"message": "Mocks cleared"}

@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def handle_mock_request(request: Request, path: str):
    """
    Catch-all handler for mock requests.
    1. Checks if a mock exists for this Method + Path.
    2. If yes, returns it.
    3. If no, uses AI to generate it, saves it, and returns it.
    """
    method = request.method
    
    # Normalize path (remove leading slash for consistency if needed, but FastAPI path param doesn't have leading slash usually)
    # Actually, let's keep it as is, or ensure we store it consistently.
    # The 'path' param in catch-all usually doesn't include the prefix. 
    # E.g. /mock-server/api/users -> path="api/users"
    
    logger.info(f"Mock Request: {method} /{path}")

    # 1. Check if mock exists
    mock_data = mock_service.get_mock(method, path)
    if mock_data:
        logger.info("Serving cached mock")
        return mock_data

    # 2. If not, generate it using AI
    logger.info("Generating new mock with AI...")
    try:
        generated_mock = await ai_service.generate_mock_response(method, path)
        
        if "error" in generated_mock and generated_mock.get("error"):
             raise HTTPException(status_code=500, detail=generated_mock["error"])

        # 3. Save it
        mock_service.add_mock(method, path, generated_mock)
        
        return generated_mock
    except Exception as e:
        logger.error(f"Mock generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate mock: {str(e)}")
