from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


from app.api.routes import router as api_router
from app.api.mock_routes import router as mock_router

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(mock_router, prefix="/mock-server", tags=["Mock Server"])

@app.get("/")
async def root():
    return {"message": "TestOrbit Backend is Running", "version": "1.0.0", "docs": "/docs"}

