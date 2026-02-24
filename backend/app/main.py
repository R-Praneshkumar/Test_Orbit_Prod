import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.config import get_settings
from app.core.security import SecurityHeadersMiddleware, HTTPSRedirectMiddleware, install_secret_masking

settings = get_settings()
_start_time = time.time()

# Install secret masking on all loggers before anything else logs
install_secret_masking()

app = FastAPI(
    title=settings.PROJECT_NAME,
    # Disable OpenAPI spec in production to reduce attack surface
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.ENV != "production" else None,
    docs_url="/docs" if settings.ENV != "production" else None,
    redoc_url="/redoc" if settings.ENV != "production" else None,
)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# HTTPS enforcement in production
if settings.ENV == "production":
    app.add_middleware(HTTPSRedirectMiddleware)

# CORS — uses ALLOWED_ORIGINS env var in production, defaults for dev
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["*"],
    )

# Rate limiting
from app.api.routes import limiter
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"error": {"code": "RATE_LIMIT_EXCEEDED", "message": f"Rate limit exceeded. Try again later.", "retry_after": exc.detail}},
        headers={"Retry-After": str(exc.detail)},
    )


from app.api.routes import router as api_router
from app.api.mock_routes import router as mock_router
from app.api.oauth_routes import router as oauth_router

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(mock_router, prefix="/mock-server", tags=["Mock Server"])
app.include_router(oauth_router, prefix=settings.API_V1_STR, tags=["OAuth 2.0"])

@app.get("/")
async def root():
    uptime = int(time.time() - _start_time)
    response = {
        "message": "TestOrbit Backend is Running",
        "version": "1.0.0",
        "uptime_seconds": uptime,
    }
    # Only expose detailed service info in non-production environments
    if settings.ENV != "production":
        gemini_ok = bool(settings.GEMINI_API_KEY)
        response["env"] = settings.ENV
        response["docs"] = "/docs"
        response["services"] = {
            "gemini": "configured" if gemini_ok else "missing_key",
            "auth": "enabled" if settings.REQUIRE_AUTH else "disabled",
        }
    return response

