from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import asyncio
import aiohttp
import logging
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.services.ai_service import ai_service
from app.services.test_runner import test_runner
from app.core.config import get_settings
from app.core.security import validate_proxy_url, verify_token

logger = logging.getLogger(__name__)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)
_settings = get_settings()

class GenerateRequest(BaseModel):
    url: str = Field(..., max_length=2048)
    context: Optional[str] = Field(None, max_length=5000)
    openapi_spec: Optional[str] = Field(None, max_length=2097152)  # 2MB
    user_instructions: Optional[str] = Field(None, max_length=5000)
    base_url: Optional[str] = Field(None, max_length=2048)

class RunRequest(BaseModel):
    base_url: str = Field(..., max_length=2048)
    tests: List[Dict[str, Any]]

class VoiceCommand(BaseModel):
    transcript: str = Field(..., max_length=5000)
    openapi_spec: Optional[str] = Field(None, max_length=2097152)  # 2MB
    conversation_history: Optional[List[Dict[str, str]]] = None
    base_url: Optional[str] = Field(None, max_length=2048)

class CodeGenRequest(BaseModel):
    method: str = Field(..., max_length=10)
    url: str = Field(..., max_length=2048)
    headers: Optional[Dict[str, str]] = None
    body: Optional[str] = Field(None, max_length=1048576)  # 1MB
    language: str = Field("python", max_length=30)
    variant: Optional[str] = Field(None, max_length=30)
    include_tests: bool = False

class DiagnoseRequest(BaseModel):
    method: str = Field(..., max_length=10)
    url: str = Field(..., max_length=2048)
    request_body: Optional[str] = Field(None, max_length=1048576)
    request_headers: Optional[Dict[str, str]] = None
    expected_status: int
    actual_status: int
    response_body: Optional[str] = Field(None, max_length=1048576)
    response_headers: Optional[Dict[str, str]] = None
    openapi_spec: Optional[str] = Field(None, max_length=2097152)  # 2MB

class ChatRequest(BaseModel):
    message: str = Field(..., max_length=5000)
    conversation_history: Optional[List[Dict[str, str]]] = None
    context: Optional[str] = Field(None, max_length=2097152)  # 2MB

class SuggestRequest(BaseModel):
    method: str = Field(..., max_length=10)
    url: str = Field(..., max_length=2048)
    endpoint_name: Optional[str] = Field(None, max_length=200)
    request_body_schema: Optional[Dict[str, Any]] = None
    response_body_sample: Optional[Dict[str, Any]] = None
    openapi_spec: Optional[str] = Field(None, max_length=2097152)  # 2MB
    existing_assertions: Optional[List[Dict[str, Any]]] = None
    categories: Optional[List[str]] = None

class ContractCheckRequest(BaseModel):
    openapi_spec: str = Field(..., max_length=2097152)  # 2MB
    base_url: str = Field(..., max_length=2048)
    endpoints: Optional[List[Dict[str, str]]] = None
    include_ai_analysis: bool = False

class ProxyRequest(BaseModel):
    url: str = Field(..., max_length=2048)
    method: str = Field("GET", max_length=10)
    headers: Optional[Dict[str, str]] = None
    body: Optional[Any] = None

@router.post("/generate")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def generate_tests(request: Request, req: GenerateRequest, user: dict = Depends(verify_token)):
    """Generates test cases using Gemini 3."""
    context = f"{req.url} {req.context or ''}"
    result = await ai_service.generate_tests(
        context,
        openapi_spec=req.openapi_spec,
        user_instructions=req.user_instructions,
        base_url=req.base_url,
    )
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/run")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def run_tests(request: Request, req: RunRequest, user: dict = Depends(verify_token)):
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

@router.post("/chat")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def chat(request: Request, req: ChatRequest, user: dict = Depends(verify_token)):
    """Conversational AI assistant for API testing help."""
    try:
        result = await ai_service.chat(
            message=req.message,
            conversation_history=req.conversation_history,
            context=req.context,
        )
        return result
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Chat failed")

@router.post("/voice")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def process_voice(request: Request, cmd: VoiceCommand, user: dict = Depends(verify_token)):
    """Processes natural language commands with optional OpenAPI spec and conversation history."""
    try:
        result = await ai_service.generate_payload_from_intent(
            cmd.transcript,
            openapi_spec=cmd.openapi_spec,
            conversation_history=cmd.conversation_history,
            base_url=cmd.base_url,
        )
        return result
    except Exception as e:
        logger.error(f"Voice processing error: {e}")
        raise HTTPException(status_code=500, detail="Voice processing failed")

@router.post("/codegen")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def generate_code(request: Request, req: CodeGenRequest, user: dict = Depends(verify_token)):
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
@limiter.limit(_settings.AI_RATE_LIMIT)
async def diagnose_failure(request: Request, req: DiagnoseRequest, user: dict = Depends(verify_token)):
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

@router.post("/suggest")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def suggest_tests(request: Request, req: SuggestRequest, user: dict = Depends(verify_token)):
    """Generates AI-powered test suggestions with assertions for a single endpoint."""
    try:
        result = await ai_service.suggest_endpoint_tests(
            method=req.method,
            url=req.url,
            endpoint_name=req.endpoint_name or "",
            request_body_schema=req.request_body_schema,
            response_body_sample=req.response_body_sample,
            openapi_spec=req.openapi_spec,
            existing_assertions=req.existing_assertions,
            categories=req.categories,
        )
        if isinstance(result, dict) and "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Suggest tests error: {e}")
        raise HTTPException(status_code=500, detail="Test suggestion generation failed")

@router.post("/contract-check")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def contract_check(request: Request, req: ContractCheckRequest, user: dict = Depends(verify_token)):
    """Runs contract checks comparing live API responses against OpenAPI schemas."""
    try:
        results = await test_runner.run_contract_check(
            openapi_spec=req.openapi_spec,
            base_url=req.base_url,
            endpoints=req.endpoints,
        )

        # Optionally add AI analysis for the top drifted endpoints
        if req.include_ai_analysis:
            drifted = [r for r in results if r.get("status") == "drift"]
            # Sort by drift count descending, limit to top 5
            drifted = sorted(drifted, key=lambda x: x.get("driftCount", 0), reverse=True)[:5]

            async def attach_analysis(endpoint_result):
                try:
                    analysis = await ai_service.explain_contract_drift(endpoint_result)
                    endpoint_result["ai_analysis"] = analysis
                except Exception as e:
                    logger.error(f"AI analysis failed for {endpoint_result.get('path')}: {e}")

            if drifted:
                await asyncio.gather(*[attach_analysis(r) for r in drifted])

        return {"results": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Contract check error: {e}")
        raise HTTPException(status_code=500, detail="Contract check failed")

@router.post("/proxy")
@limiter.limit(_settings.PROXY_RATE_LIMIT)
async def proxy_request(request: Request, req: ProxyRequest, user: dict = Depends(verify_token)):
    """
    Proxies HTTP requests to external APIs.
    This solves CORS issues by making the request from the backend.
    """
    # SSRF protection: validate the target URL
    await validate_proxy_url(req.url)

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
                    logger.error(f"Proxy response read error: {e}")
                    data = "Error reading response"
                
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
        logger.error(f"Proxy request error: {e}")
        return {
            "status": 500,
            "statusText": "Proxy Error",
            "data": "Proxy request failed",
            "headers": {}
        }


