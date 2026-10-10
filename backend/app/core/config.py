from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator
from functools import lru_cache

class Settings(BaseSettings):
    PROJECT_NAME: str = "TestOrbit"
    API_V1_STR: str = "/api/v1"
    GEMINI_API_KEY: str
    ENV: str = "development"  # development | staging | production

    # Supabase JWT verification
    SUPABASE_URL: str = ""          # e.g. https://yourproject.supabase.co — used to fetch JWKS for ES256/RS256 tokens
    SUPABASE_JWT_SECRET: str = ""  # Required for HS256 tokens; from Supabase Dashboard → Settings → API → JWT Secret
    REQUIRE_AUTH: bool = True       # JWT auth enforced by default. Set False only for local development without Supabase.
    OAUTH_STATE_SECRET: str = ""    # Optional shared signing secret for multi-worker OAuth flows.

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

    # Admin (comma-separated list of admin email addresses)
    ADMIN_EMAILS: str = ""

    # Email (Resend API for digest emails)
    RESEND_API_KEY: str = ""
    DIGEST_FROM_EMAIL: str = "TestOrbit <digest@testorbit.dev>"

    # Sentry error tracking (optional — set DSN to enable)
    SENTRY_DSN: str = ""

    # Rate limiting
    AI_RATE_LIMIT: str = "10/minute"
    PROXY_RATE_LIMIT: str = "60/minute"
    MOCK_RATE_LIMIT: str = "30/minute"

    @model_validator(mode="after")
    def validate_deployment_security(self):
        if self.ENV not in {"development", "staging", "production"}:
            raise ValueError("ENV must be development, staging, or production")
        if self.ENV != "development":
            if not self.REQUIRE_AUTH:
                raise ValueError("Authentication is required outside local development")
            if not self.SUPABASE_URL.startswith("https://"):
                raise ValueError("An HTTPS SUPABASE_URL is required outside local development")
        return self

    class Config:
        case_sensitive = True
        env_file = ".env"
        # Ignore retired billing variables in existing local environments.
        extra = "ignore"

@lru_cache()
def get_settings():
    return Settings()
