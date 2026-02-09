from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import aiohttp
import logging
from app.services.ai_service import ai_service
from app.services.test_runner import test_runner

logger = logging.getLogger(__name__)

router = APIRouter()

class GenerateRequest(BaseModel):
    url: str
    context: Optional[str] = None
    openapi_spec: Optional[str] = None
    user_instructions: Optional[str] = None

class RunRequest(BaseModel):
    base_url: str
    tests: List[Dict[str, Any]]

class VoiceCommand(BaseModel):
    transcript: str
    openapi_spec: Optional[str] = None
    conversation_history: Optional[List[Dict[str, str]]] = None

class CodeGenRequest(BaseModel):
    """Request to generate code snippets for an API request."""
    method: str
    url: str
    headers: Optional[Dict[str, str]] = None
    body: Optional[str] = None
    language: str = "python"
    variant: Optional[str] = None
    include_tests: bool = False

class DiagnoseRequest(BaseModel):
    """Request to diagnose a failed API test."""
    method: str
    url: str
    request_body: Optional[str] = None
    request_headers: Optional[Dict[str, str]] = None
    expected_status: int
    actual_status: int
    response_body: Optional[str] = None
    response_headers: Optional[Dict[str, str]] = None
    openapi_spec: Optional[str] = None

class ProxyRequest(BaseModel):
    """Request to proxy an HTTP call through the backend (avoids CORS)"""
    url: str
    method: str = "GET"
    headers: Optional[Dict[str, str]] = None
    body: Optional[Dict[str, Any]] = None

@router.post("/generate")
async def generate_tests(req: GenerateRequest):
    """Generates test cases using Gemini 3."""
    context = f"{req.url} {req.context or ''}"
    result = await ai_service.generate_tests(
        context,
        openapi_spec=req.openapi_spec,
        user_instructions=req.user_instructions
    )
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/run")
async def run_tests(req: RunRequest):
    """Runs tests in parallel using aiohttp."""
    logger.info(f"Running batch for {len(req.tests)} tests...")
    results = await test_runner.run_batch(req.tests, req.base_url)
    logger.info("Batch execution complete. Analyzing optimizations...")
    
    # Optimization Analysis (Parallelized)
    # 1. Filter candidates for optimization (slow or heavy)
    candidates = [r for r in results if r["duration_ms"] > 1000 or r["size_bytes"] > 100000]
    
    # 2. Limit to top 5 to avoid Rate Limits/Wait times
    candidates = sorted(candidates, key=lambda x: x["duration_ms"], reverse=True)[:5]

    async def analyze_and_attach(r):
        try:
            r["optimization"] = await ai_service.analyze_optimization(
                r["test_name"], r["duration_ms"], r["size_bytes"]
            )
        except Exception as e:
            logger.error(f"Optimization analysis failed: {e}")

    # 3. Run in parallel
    if candidates:
        await asyncio.gather(*[analyze_and_attach(r) for r in candidates])
            
    return {"results": results}

@router.post("/voice")
async def process_voice(cmd: VoiceCommand):
    """Processes natural language commands with optional OpenAPI spec and conversation history."""
    result = await ai_service.generate_payload_from_intent(
        cmd.transcript,
        openapi_spec=cmd.openapi_spec,
        conversation_history=cmd.conversation_history
    )
    return result

@router.post("/codegen")
async def generate_code(req: CodeGenRequest):
    """Generates code snippets for a given API request using Gemini AI."""
    result = await ai_service.generate_code(
        method=req.method,
        url=req.url,
        headers=req.headers,
        body=req.body,
        language=req.language,
        variant=req.variant,
        include_tests=req.include_tests,
    )
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/diagnose")
async def diagnose_failure(req: DiagnoseRequest):
    """Diagnoses why an API test failed using Gemini AI."""
    result = await ai_service.diagnose_failure(
        method=req.method,
        url=req.url,
        request_body=req.request_body,
        request_headers=req.request_headers,
        expected_status=req.expected_status,
        actual_status=req.actual_status,
        response_body=req.response_body,
        response_headers=req.response_headers,
        openapi_spec=req.openapi_spec,
    )
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/proxy")
async def proxy_request(req: ProxyRequest):
    """
    Proxies HTTP requests to external APIs.
    This solves CORS issues by making the request from the backend.
    """
    try:
        timeout = aiohttp.ClientTimeout(total=30)
        # Use auto_decompress=True to handle gzip/br automatically
        async with aiohttp.ClientSession(timeout=timeout) as session:
            headers = req.headers or {}
            if 'Content-Type' not in headers:
                headers['Content-Type'] = 'application/json'
            # Tell server we can accept any encoding (aiohttp handles decompression)
            headers['Accept-Encoding'] = 'gzip, deflate'
            # Remove br (Brotli) since aiohttp doesn't support it by default
            
            async with session.request(
                method=req.method,
                url=req.url,
                headers=headers,
                json=req.body if req.method.upper() not in ['GET', 'HEAD'] else None
            ) as response:
                # Read raw bytes and decode
                try:
                    raw_bytes = await response.read()
                    text = raw_bytes.decode('utf-8', errors='replace')
                    # Try to parse as JSON
                    try:
                        import json
                        data = json.loads(text)
                    except Exception:
                        data = text
                except Exception as e:
                    data = f"Error reading response: {str(e)}"
                
                return {
                    "status": response.status,
                    "statusText": response.reason or "Unknown",
                    "data": data,
                    "headers": dict(response.headers)
                }
    except asyncio.TimeoutError:
        return {
            "status": 504,
            "statusText": "Gateway Timeout",
            "data": "Request timed out after 30 seconds. The external API is too slow.",
            "headers": {}
        }
    except Exception as e:
        return {
            "status": 500,
            "statusText": "Proxy Error",
            "data": f"Error: {str(e)}",
            "headers": {}
        }


