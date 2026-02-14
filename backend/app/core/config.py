from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache

class Settings(BaseSettings):
    PROJECT_NAME: str = "TestOrbit"
    API_V1_STR: str = "/api/v1"
    GEMINI_API_KEY: str
    ENV: str = "development"  # development | staging | production

    # Supabase JWT verification
    SUPABASE_JWT_SECRET: str = ""  # Required in production; from Supabase Dashboard → Settings → API → JWT Secret
    REQUIRE_AUTH: bool = False      # Set True in production to enforce JWT auth on all API routes

    # CORS — comma-separated in env, or use defaults for dev
    ALLOWED_ORIGINS: str = ""
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://localhost:3000",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v, info):
        # If ALLOWED_ORIGINS env var is set, use that instead of defaults
        allowed = info.data.get("ALLOWED_ORIGINS", "")
        if allowed:
            return [o.strip() for o in allowed.split(",") if o.strip()]
        return v

    # Rate limiting
    AI_RATE_LIMIT: str = "10/minute"
    PROXY_RATE_LIMIT: str = "60/minute"
    MOCK_RATE_LIMIT: str = "30/minute"

    class Config:
        case_sensitive = True
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
