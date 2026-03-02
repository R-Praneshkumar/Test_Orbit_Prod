from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
import asyncio
import json as json_module
import aiohttp
import logging
import jwt as pyjwt
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.services.ai_service import ai_service
from app.services.test_runner import test_runner
from app.services.usage_service import usage_service
from app.core.config import get_settings
from app.core.security import validate_proxy_url, verify_token, PinnedResolver

logger = logging.getLogger(__name__)

router = APIRouter()
_settings = get_settings()


def _get_rate_limit_key(request: Request) -> str:
    """Extract user ID from JWT for per-user rate limiting. Falls back to IP."""
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        try:
            payload = pyjwt.decode(auth[7:], options={"verify_signature": False})
            user_id = payload.get("sub")
            if user_id and user_id != "anonymous":
                return f"user:{user_id}"
        except Exception:
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=_get_rate_limit_key)


def _enforce_daily_limit(endpoint: str, user: dict):
    """Check daily usage limits before an AI call. Raises 429 if exceeded."""
    user_id = user.get("sub", "anonymous")
    if user_id == "anonymous":
        return
    exceeded = usage_service.check_limit(user_id, endpoint)
    if exceeded:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "DAILY_LIMIT_EXCEEDED",
                "message": f"Daily {exceeded['category'].replace('_', ' ')} limit reached ({exceeded['limit']}). Upgrade to Pro for unlimited access.",
                "category": exceeded["category"],
                "used": exceeded["used"],
                "limit": exceeded["limit"],
                "upgrade_url": "/pricing",
            },
        )

# Maximum proxy request body size: 10MB
MAX_PROXY_BODY_SIZE = 10_485_760

# --- Proxy header filtering ---
# Request headers to strip before forwarding to external APIs.
# These are hop-by-hop headers or headers that could enable abuse.
BLOCKED_REQUEST_HEADERS = frozenset({
    'host',                  # Must be set by aiohttp based on target URL
    'cookie',                # Don't forward our cookies to external APIs
    'connection',            # Hop-by-hop
    'keep-alive',            # Hop-by-hop
    'transfer-encoding',     # Hop-by-hop
    'te',                    # Hop-by-hop
    'trailer',               # Hop-by-hop
    'upgrade',               # Hop-by-hop
    'proxy-authorization',   # Could leak proxy credentials
    'proxy-connection',      # Hop-by-hop
    'sec-fetch-dest',        # Browser-only metadata
    'sec-fetch-mode',        # Browser-only metadata
    'sec-fetch-site',        # Browser-only metadata
    'sec-fetch-user',        # Browser-only metadata
    'origin',                # Our origin, not the user's intent
    'referer',               # Leaks our URL to external APIs
})

# Response headers allowed to be forwarded back to the client.
# Everything else is stripped (deny-by-default).
ALLOWED_RESPONSE_HEADERS = frozenset({
    'content-type',
    'content-length',
    'content-encoding',
    'content-language',
    'content-disposition',
    'cache-control',
    'etag',
    'last-modified',
    'expires',
    'pragma',
    'date',
    'vary',
    'age',
    'retry-after',
    'location',
    'link',
    'x-request-id',
    'x-correlation-id',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
    'x-total-count',
    'x-page',
    'x-per-page',
    'x-total-pages',
    'www-authenticate',
    'allow',
    'accept-ranges',
})


def filter_request_headers(headers: dict) -> dict:
    """Strip dangerous/hop-by-hop headers from outgoing proxy requests."""
    return {
        k: v for k, v in headers.items()
        if k.lower() not in BLOCKED_REQUEST_HEADERS
    }


def filter_response_headers(headers) -> dict:
    """Only forward allowlisted headers from external API responses."""
    filtered = {}
    for k, v in headers.items():
        lower_key = k.lower()
        if lower_key in ALLOWED_RESPONSE_HEADERS:
            filtered[k] = v
        # Also allow CORS headers (access-control-*)
        elif lower_key.startswith('access-control-'):
            filtered[k] = v
    return filtered


async def enforce_proxy_body_limit(request: Request):
    """Reject proxy requests with bodies larger than 10MB (413 Payload Too Large)."""
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_PROXY_BODY_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=f"Payload too large. Maximum request body size is {MAX_PROXY_BODY_SIZE // (1024 * 1024)}MB."
                )
        except ValueError:
            pass

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
    body_type: str = Field("json", max_length=20)

    @field_validator('body', mode='before')
    @classmethod
    def check_body_size(cls, v):
        if v is not None:
            try:
                serialized = json_module.dumps(v) if not isinstance(v, (str, bytes)) else v
                size = len(serialized.encode('utf-8') if isinstance(serialized, str) else serialized)
                if size > MAX_PROXY_BODY_SIZE:
                    raise ValueError(f'Request body exceeds {MAX_PROXY_BODY_SIZE // (1024 * 1024)}MB limit')
            except (TypeError, OverflowError):
                pass
        return v

@router.post("/generate")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def generate_tests(request: Request, req: GenerateRequest, user: dict = Depends(verify_token)):
    """Generates test cases using Gemini 3."""
    _enforce_daily_limit("generate", user)
    context = f"{req.url} {req.context or ''}"
    result = await ai_service.generate_tests(
        context,
        openapi_spec=req.openapi_spec,
        user_instructions=req.user_instructions,
        base_url=req.base_url,
    )
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    usage_service.record(user.get("sub", "anonymous"), "generate")
    return result

@router.post("/run")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def run_tests(request: Request, req: RunRequest, user: dict = Depends(verify_token)):
    """Runs tests in parallel using aiohttp."""
    _enforce_daily_limit("run", user)
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

    usage_service.record(user.get("sub", "anonymous"), "run")
    return {"results": results}

@router.post("/chat")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def chat(request: Request, req: ChatRequest, user: dict = Depends(verify_token)):
    """Conversational AI assistant for API testing help."""
    _enforce_daily_limit("chat", user)
    try:
        result = await ai_service.chat(
            message=req.message,
            conversation_history=req.conversation_history,
            context=req.context,
        )
        usage_service.record(user.get("sub", "anonymous"), "chat")
        return result
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Chat failed")

@router.post("/voice")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def process_voice(request: Request, cmd: VoiceCommand, user: dict = Depends(verify_token)):
    """Processes natural language commands with optional OpenAPI spec and conversation history."""
    _enforce_daily_limit("voice", user)
    try:
        result = await ai_service.generate_payload_from_intent(
            cmd.transcript,
            openapi_spec=cmd.openapi_spec,
            conversation_history=cmd.conversation_history,
            base_url=cmd.base_url,
        )
        usage_service.record(user.get("sub", "anonymous"), "voice")
        return result
    except Exception as e:
        logger.error(f"Voice processing error: {e}")
        raise HTTPException(status_code=500, detail="Voice processing failed")

@router.post("/codegen")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def generate_code(request: Request, req: CodeGenRequest, user: dict = Depends(verify_token)):
    """Generates code snippets for a given API request using Gemini AI."""
    _enforce_daily_limit("codegen", user)
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
    usage_service.record(user.get("sub", "anonymous"), "codegen")
    return result

@router.post("/diagnose")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def diagnose_failure(request: Request, req: DiagnoseRequest, user: dict = Depends(verify_token)):
    """Diagnoses why an API test failed using Gemini AI."""
    _enforce_daily_limit("diagnose", user)
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
    usage_service.record(user.get("sub", "anonymous"), "diagnose")
    return result

@router.post("/suggest")
@limiter.limit(_settings.AI_RATE_LIMIT)
async def suggest_tests(request: Request, req: SuggestRequest, user: dict = Depends(verify_token)):
    """Generates AI-powered test suggestions with assertions for a single endpoint."""
    _enforce_daily_limit("suggest", user)
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
        usage_service.record(user.get("sub", "anonymous"), "suggest")
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
    _enforce_daily_limit("contract-check", user)
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

        usage_service.record(user.get("sub", "anonymous"), "contract-check")
        return {"results": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Contract check error: {e}")
        raise HTTPException(status_code=500, detail="Contract check failed")

@router.post("/proxy")
@limiter.limit(_settings.PROXY_RATE_LIMIT)
async def proxy_request(request: Request, req: ProxyRequest, user: dict = Depends(verify_token), _body_check: None = Depends(enforce_proxy_body_limit)):
    """
    Proxies HTTP requests to external APIs.
    This solves CORS issues by making the request from the backend.
    """
    # SSRF protection: validate the target URL and get pre-resolved addresses
    hostname, resolved_addrs = await validate_proxy_url(req.url)

    try:
        timeout = aiohttp.ClientTimeout(total=30)
        # Pin DNS to the pre-resolved IPs to prevent DNS rebinding (TOCTOU)
        connector = aiohttp.TCPConnector(resolver=PinnedResolver(hostname, resolved_addrs))
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            # Filter outgoing request headers (strip dangerous/hop-by-hop)
            headers = filter_request_headers(req.headers or {})
            headers['Accept-Encoding'] = 'gzip, deflate'

            # Build request body based on body_type
            request_kwargs = {}
            if req.method.upper() not in ['GET', 'HEAD'] and req.body is not None:
                if req.body_type == 'form' and isinstance(req.body, list):
                    form = aiohttp.FormData()
                    for pair in req.body:
                        if isinstance(pair, dict):
                            form.add_field(pair.get('key', ''), str(pair.get('value', '')))
                    request_kwargs['data'] = form
                    headers.pop('Content-Type', None)  # Let aiohttp set multipart boundary
                elif req.body_type == 'urlencoded':
                    if isinstance(req.body, list):
                        pairs = {p['key']: p.get('value', '') for p in req.body if isinstance(p, dict)}
                        request_kwargs['data'] = pairs
                    else:
                        request_kwargs['data'] = str(req.body)
                    headers['Content-Type'] = 'application/x-www-form-urlencoded'
                elif req.body_type == 'raw':
                    request_kwargs['data'] = str(req.body)
                    if 'Content-Type' not in headers:
                        headers['Content-Type'] = 'text/plain'
                else:
                    request_kwargs['json'] = req.body
                    if 'Content-Type' not in headers:
                        headers['Content-Type'] = 'application/json'
            else:
                if 'Content-Type' not in headers:
                    headers['Content-Type'] = 'application/json'

            async with session.request(
                method=req.method,
                url=req.url,
                headers=headers,
                **request_kwargs
            ) as response:
                try:
                    raw_bytes = await response.read()
                    text = raw_bytes.decode('utf-8', errors='replace')
                    try:
                        data = json_module.loads(text)
                    except Exception:
                        data = text
                except Exception as e:
                    logger.error(f"Proxy response read error: {e}")
                    data = "Error reading response"

                # Filter response headers (allowlist only)
                return {
                    "status": response.status,
                    "statusText": response.reason or "Unknown",
                    "data": data,
                    "headers": filter_response_headers(response.headers)
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


@router.get("/usage/today")
async def get_usage_today(request: Request, user: dict = Depends(verify_token)):
    """Get today's AI usage stats for the authenticated user."""
    plan = "free"  # Full plan lookup from Supabase in S4.3
    return usage_service.get_today(user.get("sub", "anonymous"), plan)
