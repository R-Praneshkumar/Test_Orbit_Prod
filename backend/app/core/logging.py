"""
Structured JSON logging with request ID context.

Produces one-line JSON log entries parseable by CloudWatch, Datadog, and ELK.
Each HTTP request gets a unique request_id (UUID) propagated via contextvars.
"""
import json
import logging
import time
import uuid
from contextvars import ContextVar

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

# ── Context vars (per-request) ──────────────────────────────────

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
user_id_var: ContextVar[str] = ContextVar("user_id", default="-")


# ── JSON Formatter ──────────────────────────────────────────────

class JSONFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_var.get("-"),
        }
        # Include user_id when available
        uid = user_id_var.get("-")
        if uid != "-":
            entry["user_id"] = uid
        # Include exception info
        if record.exc_info and record.exc_info[0] is not None:
            entry["exception"] = self.formatException(record.exc_info)
        # Include extra fields set by the request logging middleware
        for key in ("method", "url", "status", "duration_ms", "client_ip"):
            val = getattr(record, key, None)
            if val is not None:
                entry[key] = val
        return json.dumps(entry, default=str)


# ── Setup helper ────────────────────────────────────────────────

def setup_structured_logging(level: str = "INFO"):
    """
    Replace the root logger's handlers with a single JSON-to-stdout handler.
    Call once at startup, AFTER install_secret_masking().
    """
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove existing handlers (uvicorn adds its own)
    for h in root.handlers[:]:
        root.removeHandler(h)

    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    root.addHandler(handler)

    # Quiet down noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("aiohttp").setLevel(logging.WARNING)


# ── Request Logging Middleware ──────────────────────────────────

# Paths to skip logging (health checks, static, favicon)
_SKIP_PATHS = frozenset({"/", "/favicon.ico", "/health", "/openapi.json", "/docs", "/redoc"})


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that:
    1. Generates a UUID request_id and stores it in contextvars
    2. Extracts user_id from the JWT (if present) into contextvars
    3. Logs method, URL, status, duration_ms, user_id on completion
    4. Returns X-Request-ID response header
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Generate / accept request ID
        rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:16]
        request_id_var.set(rid)

        # Extract user_id from JWT token (lightweight — no full verification here)
        uid = _extract_user_hint(request)
        user_id_var.set(uid)

        start = time.perf_counter()
        status_code = 500  # default if call_next raises

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 1)
            response_obj = response if status_code != 500 else None
            if response_obj is not None:
                response_obj.headers["X-Request-ID"] = rid

            # Skip noisy paths
            path = request.url.path
            if path not in _SKIP_PATHS:
                logger = logging.getLogger("testorbit.access")
                logger.info(
                    "%s %s → %s (%.1fms)",
                    request.method,
                    path,
                    status_code,
                    duration_ms,
                    extra={
                        "method": request.method,
                        "url": path,
                        "status": status_code,
                        "duration_ms": duration_ms,
                        "client_ip": _get_client_ip(request),
                    },
                )


def _extract_user_hint(request: Request) -> str:
    """
    Extract user sub from JWT without full verification.
    This is only for logging context — auth is handled by verify_token().
    """
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return "-"
    token = auth[7:]
    try:
        # Decode payload without verification (just for the 'sub' claim)
        import base64
        parts = token.split(".")
        if len(parts) < 2:
            return "-"
        # Add padding
        payload_b64 = parts[1] + "=" * (4 - len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return payload.get("sub", "-")
    except Exception:
        return "-"


def _get_client_ip(request: Request) -> str:
    """Get client IP, respecting X-Forwarded-For from reverse proxies."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "-"
