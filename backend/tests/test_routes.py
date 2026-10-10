"""
TestOrbit Backend Integration Tests

Tests cover:
- All 9 main API endpoints with mocked AI service
- Auth: verify_token dependency (anon dev mode + missing token)
- SSRF: validate_proxy_url (blocked schemes, cloud metadata)
- Proxy: header filtering, body size limits
- Input validation: Pydantic field limits
- OAuth: state generation, token exchange models
- Security: headers middleware, secret masking
"""
import os
import sys
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

# Ensure backend root is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Set required env vars BEFORE importing app
os.environ.setdefault("GEMINI_API_KEY", "test-key-fake")
os.environ.setdefault("REQUIRE_AUTH", "false")

from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import verify_token


# ─── Fixtures ────────────────────────────────────────────────────────

FAKE_USER = {"sub": "test-user-123", "email": "test@testorbit.dev", "role": "authenticated"}


@pytest.fixture
def override_auth():
    """Override verify_token to return a fake user (no JWT needed)."""
    app.dependency_overrides[verify_token] = lambda: FAKE_USER
    yield
    app.dependency_overrides.pop(verify_token, None)


@pytest.fixture
def client(override_auth):
    """Async HTTP client with auth overridden."""
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ─── Canned AI Responses ─────────────────────────────────────────────

GENERATE_RESPONSE = {
    "test_suite_name": "User API Tests",
    "tests": [
        {
            "name": "GET /users returns 200",
            "method": "GET",
            "endpoint": "https://api.example.com/users",
            "expected_status": 200,
        }
    ],
}

CHAT_RESPONSE = {"response": "You can test this endpoint using a GET request.", "type": "chat"}

VOICE_RESPONSE = {
    "method": "GET",
    "url": "https://api.example.com/users",
    "name": "List Users",
}

CODEGEN_RESPONSE = {
    "code": "import requests\nresponse = requests.get('https://api.example.com/users')",
    "language": "python",
    "filename": "test_api.py",
}

DIAGNOSE_RESPONSE = {
    "root_cause": "Authentication header missing",
    "explanation": "The 401 suggests the API requires a Bearer token.",
    "suggested_fix": "Add Authorization: Bearer <token> header.",
    "confidence": "high",
}

SUGGEST_RESPONSE = {
    "suggestions": [
        {
            "name": "Status code is 200",
            "assertions": [
                {"type": "status_code", "comparison": "equals", "expected": "200"}
            ],
        }
    ]
}

CONTRACT_CHECK_RESULTS = [
    {"path": "/users", "method": "GET", "status": "pass", "driftCount": 0, "drifts": []},
]

RUN_BATCH_RESULTS = [
    {"test_name": "GET /users", "status": 200, "passed": True, "duration_ms": 50, "size_bytes": 500},
]


# ═══════════════════════════════════════════════════════════════════════
# AI Endpoint Integration Tests
# ═══════════════════════════════════════════════════════════════════════

class TestGenerateEndpoint:
    """POST /api/v1/generate"""

    @pytest.mark.asyncio
    async def test_generate_success(self, client):
        with patch("app.api.routes.ai_service.generate_tests", new_callable=AsyncMock, return_value=GENERATE_RESPONSE):
            resp = await client.post("/api/v1/generate", json={"url": "https://api.example.com/users"})
        assert resp.status_code == 200
        data = resp.json()
        assert "tests" in data
        assert data["test_suite_name"] == "User API Tests"

    @pytest.mark.asyncio
    async def test_generate_with_optional_fields(self, client):
        with patch("app.api.routes.ai_service.generate_tests", new_callable=AsyncMock, return_value=GENERATE_RESPONSE):
            resp = await client.post("/api/v1/generate", json={
                "url": "https://api.example.com/users",
                "context": "REST API for user management",
                "user_instructions": "Focus on auth tests",
                "base_url": "https://api.example.com",
            })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_generate_ai_error(self, client):
        with patch("app.api.routes.ai_service.generate_tests", new_callable=AsyncMock, return_value={"error": "Gemini API failed"}):
            resp = await client.post("/api/v1/generate", json={"url": "https://api.example.com"})
        assert resp.status_code == 500

    @pytest.mark.asyncio
    async def test_generate_missing_url(self, client):
        resp = await client.post("/api/v1/generate", json={})
        assert resp.status_code == 422  # Pydantic validation


class TestChatEndpoint:
    """POST /api/v1/chat"""

    @pytest.mark.asyncio
    async def test_chat_success(self, client):
        with patch("app.api.routes.ai_service.chat", new_callable=AsyncMock, return_value=CHAT_RESPONSE):
            resp = await client.post("/api/v1/chat", json={"message": "How do I test a REST API?"})
        assert resp.status_code == 200
        assert resp.json()["type"] == "chat"

    @pytest.mark.asyncio
    async def test_chat_with_history(self, client):
        with patch("app.api.routes.ai_service.chat", new_callable=AsyncMock, return_value=CHAT_RESPONSE):
            resp = await client.post("/api/v1/chat", json={
                "message": "What about headers?",
                "conversation_history": [{"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello!"}],
            })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_chat_exception_returns_500(self, client):
        with patch("app.api.routes.ai_service.chat", new_callable=AsyncMock, side_effect=Exception("AI broke")):
            resp = await client.post("/api/v1/chat", json={"message": "hello"})
        assert resp.status_code == 500

    @pytest.mark.asyncio
    async def test_chat_missing_message(self, client):
        resp = await client.post("/api/v1/chat", json={})
        assert resp.status_code == 422


class TestVoiceEndpoint:
    """POST /api/v1/voice"""

    @pytest.mark.asyncio
    async def test_voice_success(self, client):
        with patch("app.api.routes.ai_service.generate_payload_from_intent", new_callable=AsyncMock, return_value=VOICE_RESPONSE):
            resp = await client.post("/api/v1/voice", json={"transcript": "Create a GET request for users"})
        assert resp.status_code == 200
        assert resp.json()["method"] == "GET"

    @pytest.mark.asyncio
    async def test_voice_exception_returns_500(self, client):
        with patch("app.api.routes.ai_service.generate_payload_from_intent", new_callable=AsyncMock, side_effect=RuntimeError("fail")):
            resp = await client.post("/api/v1/voice", json={"transcript": "hello"})
        assert resp.status_code == 500


class TestCodegenEndpoint:
    """POST /api/v1/codegen"""

    @pytest.mark.asyncio
    async def test_codegen_success(self, client):
        with patch("app.api.routes.ai_service.generate_code", new_callable=AsyncMock, return_value=CODEGEN_RESPONSE):
            resp = await client.post("/api/v1/codegen", json={
                "method": "GET",
                "url": "https://api.example.com/users",
                "language": "python",
            })
        assert resp.status_code == 200
        assert "code" in resp.json()
        assert resp.json()["language"] == "python"

    @pytest.mark.asyncio
    async def test_codegen_ai_error(self, client):
        with patch("app.api.routes.ai_service.generate_code", new_callable=AsyncMock, return_value={"error": "Codegen failed"}):
            resp = await client.post("/api/v1/codegen", json={"method": "GET", "url": "https://x.com"})
        assert resp.status_code == 500

    @pytest.mark.asyncio
    async def test_codegen_with_body_and_tests(self, client):
        with patch("app.api.routes.ai_service.generate_code", new_callable=AsyncMock, return_value=CODEGEN_RESPONSE):
            resp = await client.post("/api/v1/codegen", json={
                "method": "POST",
                "url": "https://api.example.com/users",
                "body": '{"name": "Alice"}',
                "language": "javascript",
                "variant": "axios",
                "include_tests": True,
                "headers": {"Authorization": "Bearer token"},
            })
        assert resp.status_code == 200


class TestDiagnoseEndpoint:
    """POST /api/v1/diagnose"""

    @pytest.mark.asyncio
    async def test_diagnose_success(self, client):
        with patch("app.api.routes.ai_service.diagnose_failure", new_callable=AsyncMock, return_value=DIAGNOSE_RESPONSE):
            resp = await client.post("/api/v1/diagnose", json={
                "method": "GET",
                "url": "https://api.example.com/users",
                "expected_status": 200,
                "actual_status": 401,
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["confidence"] == "high"
        assert "root_cause" in data

    @pytest.mark.asyncio
    async def test_diagnose_ai_error(self, client):
        with patch("app.api.routes.ai_service.diagnose_failure", new_callable=AsyncMock, return_value={"error": "fail"}):
            resp = await client.post("/api/v1/diagnose", json={
                "method": "GET", "url": "https://x.com",
                "expected_status": 200, "actual_status": 500,
            })
        assert resp.status_code == 500


class TestSuggestEndpoint:
    """POST /api/v1/suggest"""

    @pytest.mark.asyncio
    async def test_suggest_success(self, client):
        with patch("app.api.routes.ai_service.suggest_endpoint_tests", new_callable=AsyncMock, return_value=SUGGEST_RESPONSE):
            resp = await client.post("/api/v1/suggest", json={
                "method": "GET",
                "url": "https://api.example.com/users",
            })
        assert resp.status_code == 200
        assert "suggestions" in resp.json()

    @pytest.mark.asyncio
    async def test_suggest_ai_error(self, client):
        with patch("app.api.routes.ai_service.suggest_endpoint_tests", new_callable=AsyncMock, return_value={"error": "nope"}):
            resp = await client.post("/api/v1/suggest", json={"method": "GET", "url": "https://x.com"})
        assert resp.status_code == 500

    @pytest.mark.asyncio
    async def test_suggest_exception_returns_500(self, client):
        with patch("app.api.routes.ai_service.suggest_endpoint_tests", new_callable=AsyncMock, side_effect=Exception("boom")):
            resp = await client.post("/api/v1/suggest", json={"method": "GET", "url": "https://x.com"})
        assert resp.status_code == 500


class TestRunEndpoint:
    """POST /api/v1/run"""

    @pytest.mark.asyncio
    async def test_run_success(self, client):
        with patch("app.api.routes.test_runner.run_batch", new_callable=AsyncMock, return_value=RUN_BATCH_RESULTS):
            resp = await client.post("/api/v1/run", json={
                "base_url": "https://api.example.com",
                "tests": [{"name": "GET /users", "method": "GET", "endpoint": "/users", "expected_status": 200}],
            })
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert len(data["results"]) == 1

    @pytest.mark.asyncio
    async def test_run_with_optimization(self, client):
        """Tests that slow results trigger optimization analysis."""
        slow_results = [
            {"test_name": "Slow Endpoint", "status": 200, "passed": True, "duration_ms": 5000, "size_bytes": 200000},
        ]
        with patch("app.api.routes.test_runner.run_batch", new_callable=AsyncMock, return_value=slow_results):
            with patch("app.api.routes.ai_service.analyze_optimization", new_callable=AsyncMock, return_value=[{"issue": "Slow", "suggestion": "Cache"}]):
                resp = await client.post("/api/v1/run", json={
                    "base_url": "https://api.example.com",
                    "tests": [{"name": "Test"}],
                })
        assert resp.status_code == 200


class TestContractCheckEndpoint:
    """POST /api/v1/contract-check"""

    @pytest.mark.asyncio
    async def test_contract_check_success(self, client):
        with patch("app.api.routes.test_runner.run_contract_check", new_callable=AsyncMock, return_value=CONTRACT_CHECK_RESULTS):
            resp = await client.post("/api/v1/contract-check", json={
                "openapi_spec": '{"openapi":"3.0.0","paths":{}}',
                "base_url": "https://api.example.com",
            })
        assert resp.status_code == 200
        assert "results" in resp.json()

    @pytest.mark.asyncio
    async def test_contract_check_with_ai_analysis(self, client):
        drift_results = [{"path": "/users", "method": "GET", "status": "drift", "driftCount": 2, "drifts": []}]
        ai_explanation = {"explanation": "Field type changed", "recommendation": "Update schema", "severity_summary": "medium"}
        with patch("app.api.routes.test_runner.run_contract_check", new_callable=AsyncMock, return_value=drift_results):
            with patch("app.api.routes.ai_service.explain_contract_drift", new_callable=AsyncMock, return_value=ai_explanation):
                resp = await client.post("/api/v1/contract-check", json={
                    "openapi_spec": '{"openapi":"3.0.0","paths":{}}',
                    "base_url": "https://api.example.com",
                    "include_ai_analysis": True,
                })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_contract_check_exception(self, client):
        with patch("app.api.routes.test_runner.run_contract_check", new_callable=AsyncMock, side_effect=Exception("fail")):
            resp = await client.post("/api/v1/contract-check", json={
                "openapi_spec": '{}', "base_url": "https://x.com",
            })
        assert resp.status_code == 500


# ═══════════════════════════════════════════════════════════════════════
# Proxy Endpoint Tests
# ═══════════════════════════════════════════════════════════════════════

class TestProxyEndpoint:
    """POST /api/v1/proxy"""

    @pytest.mark.asyncio
    async def test_proxy_success(self, client):
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.reason = "OK"
        mock_response.read = AsyncMock(return_value=b'{"users":[]}')
        async def response_chunks(_size):
            yield b'{"users":[]}'
        mock_response.content = MagicMock()
        mock_response.content.iter_chunked = response_chunks
        mock_response.headers = {"Content-Type": "application/json", "X-Request-Id": "abc"}

        mock_session_ctx = AsyncMock()
        mock_session_ctx.__aenter__ = AsyncMock(return_value=mock_response)
        mock_session_ctx.__aexit__ = AsyncMock(return_value=False)

        mock_session = AsyncMock()
        mock_session.request = MagicMock(return_value=mock_session_ctx)

        mock_client_ctx = AsyncMock()
        mock_client_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_client_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("app.api.routes.validate_proxy_url", new_callable=AsyncMock, return_value=("api.example.com", [("93.184.216.34", 2)])):
            with patch("app.api.routes.aiohttp.ClientSession", return_value=mock_client_ctx):
                resp = await client.post("/api/v1/proxy", json={
                    "url": "https://api.example.com/users",
                    "method": "GET",
                })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == 200
        assert data["data"] == {"users": []}

    @pytest.mark.asyncio
    async def test_proxy_ssrf_blocked(self, client):
        """SSRF protection blocks cloud metadata endpoint."""
        from fastapi import HTTPException
        with patch("app.api.routes.validate_proxy_url", new_callable=AsyncMock, side_effect=HTTPException(status_code=400, detail="Hostname 'metadata.google.internal' is not allowed")):
            resp = await client.post("/api/v1/proxy", json={
                "url": "http://metadata.google.internal/computeMetadata/v1/",
                "method": "GET",
            })
        assert resp.status_code == 400
        assert "not allowed" in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_proxy_invalid_scheme(self, client):
        from fastapi import HTTPException
        with patch("app.api.routes.validate_proxy_url", new_callable=AsyncMock, side_effect=HTTPException(status_code=400, detail="Scheme 'ftp' not allowed")):
            resp = await client.post("/api/v1/proxy", json={
                "url": "ftp://evil.com/file",
                "method": "GET",
            })
        assert resp.status_code == 400


# ═══════════════════════════════════════════════════════════════════════
# Authentication Tests
# ═══════════════════════════════════════════════════════════════════════

class TestAuthentication:
    """Test verify_token behavior."""

    @pytest.mark.asyncio
    async def test_anon_dev_mode_allows_access(self):
        """In dev mode (REQUIRE_AUTH=false), missing token returns anon user."""
        # Remove auth override so the real verify_token runs
        app.dependency_overrides.pop(verify_token, None)
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                with patch("app.api.routes.ai_service.chat", new_callable=AsyncMock, return_value=CHAT_RESPONSE):
                    resp = await c.post("/api/v1/chat", json={"message": "hi"})
            assert resp.status_code == 200
        finally:
            app.dependency_overrides.pop(verify_token, None)

    @pytest.mark.asyncio
    async def test_require_auth_rejects_missing_token(self):
        """When REQUIRE_AUTH=True, missing token returns 401."""
        app.dependency_overrides.pop(verify_token, None)
        # Temporarily make verify_token strict
        from app.core.config import get_settings
        settings = get_settings()
        original = settings.REQUIRE_AUTH
        try:
            settings.REQUIRE_AUTH = True
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                resp = await c.post("/api/v1/chat", json={"message": "hi"})
            assert resp.status_code in (401, 403)
        finally:
            settings.REQUIRE_AUTH = original
            app.dependency_overrides.pop(verify_token, None)

    @pytest.mark.asyncio
    async def test_invalid_jwt_in_strict_mode(self):
        """Invalid JWT token returns 401 in strict auth mode."""
        app.dependency_overrides.pop(verify_token, None)
        from app.core.config import get_settings
        settings = get_settings()
        original = settings.REQUIRE_AUTH
        try:
            settings.REQUIRE_AUTH = True
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                resp = await c.post(
                    "/api/v1/chat",
                    json={"message": "hi"},
                    headers={"Authorization": "Bearer invalid.token.here"},
                )
            assert resp.status_code == 401
        finally:
            settings.REQUIRE_AUTH = original
            app.dependency_overrides.pop(verify_token, None)


# ═══════════════════════════════════════════════════════════════════════
# SSRF Validation Tests (unit-level)
# ═══════════════════════════════════════════════════════════════════════

class TestSSRFValidation:
    """Test validate_proxy_url security checks."""

    @pytest.mark.asyncio
    async def test_blocks_cloud_metadata(self):
        from app.core.security import validate_proxy_url
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await validate_proxy_url("http://metadata.google.internal/computeMetadata/v1/")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_blocks_ftp_scheme(self):
        from app.core.security import validate_proxy_url
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await validate_proxy_url("ftp://example.com/file")
        assert exc_info.value.status_code == 400
        assert "Scheme" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_blocks_no_hostname(self):
        from app.core.security import validate_proxy_url
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await validate_proxy_url("http://")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_allows_public_url(self):
        from app.core.security import validate_proxy_url
        hostname, addrs = await validate_proxy_url("https://httpbin.org/get")
        assert hostname == "httpbin.org"
        assert len(addrs) > 0

    @pytest.mark.asyncio
    async def test_blocks_private_ip_in_production(self):
        from app.core.security import validate_proxy_url
        from app.core.config import get_settings
        from fastapi import HTTPException
        settings = get_settings()
        original = settings.ENV
        try:
            settings.ENV = "production"
            with pytest.raises(HTTPException) as exc_info:
                await validate_proxy_url("http://10.0.0.1/internal")
            assert exc_info.value.status_code == 400
        finally:
            settings.ENV = original


# ═══════════════════════════════════════════════════════════════════════
# Proxy Header Filtering Tests
# ═══════════════════════════════════════════════════════════════════════

class TestProxyHeaderFiltering:
    """Test request/response header filtering."""

    def test_filter_request_headers_strips_dangerous(self):
        from app.api.routes import filter_request_headers
        headers = {
            "Authorization": "Bearer token",
            "Content-Type": "application/json",
            "Host": "evil.com",
            "Cookie": "session=abc",
            "X-Custom": "safe",
            "Origin": "http://localhost",
            "Referer": "http://localhost/page",
        }
        filtered = filter_request_headers(headers)
        assert "Authorization" in filtered
        assert "Content-Type" in filtered
        assert "X-Custom" in filtered
        assert "Host" not in filtered
        assert "Cookie" not in filtered
        assert "Origin" not in filtered
        assert "Referer" not in filtered

    def test_filter_response_headers_allowlist(self):
        from app.api.routes import filter_response_headers
        headers = {
            "Content-Type": "application/json",
            "Server": "nginx/1.18",
            "Set-Cookie": "session=abc; HttpOnly",
            "X-Powered-By": "Express",
            "ETag": '"abc123"',
            "Cache-Control": "no-cache",
            "X-Request-Id": "req-123",
            "Access-Control-Allow-Origin": "*",
        }
        filtered = filter_response_headers(headers)
        assert "Content-Type" in filtered
        assert "ETag" in filtered
        assert "Cache-Control" in filtered
        assert "X-Request-Id" in filtered
        assert "Access-Control-Allow-Origin" in filtered
        assert "Server" not in filtered
        assert "Set-Cookie" not in filtered
        assert "X-Powered-By" not in filtered


# ═══════════════════════════════════════════════════════════════════════
# Input Validation Tests
# ═══════════════════════════════════════════════════════════════════════

class TestInputValidation:
    """Test Pydantic model field validation / limits."""

    @pytest.mark.asyncio
    async def test_url_max_length(self, client):
        """URLs exceeding 2048 chars should be rejected."""
        with patch("app.api.routes.ai_service.generate_tests", new_callable=AsyncMock, return_value=GENERATE_RESPONSE):
            resp = await client.post("/api/v1/generate", json={"url": "https://x.com/" + "a" * 2100})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_context_max_length(self, client):
        """Context exceeding 5000 chars should be rejected."""
        with patch("app.api.routes.ai_service.generate_tests", new_callable=AsyncMock, return_value=GENERATE_RESPONSE):
            resp = await client.post("/api/v1/generate", json={
                "url": "https://api.example.com",
                "context": "x" * 5500,
            })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_chat_message_max_length(self, client):
        resp = await client.post("/api/v1/chat", json={"message": "x" * 5500})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_proxy_body_size_validation(self, client):
        """Proxy body exceeding 10MB should be rejected (413 or 422)."""
        huge_body = "x" * (11 * 1024 * 1024)  # 11MB string
        resp = await client.post("/api/v1/proxy", json={
            "url": "https://api.example.com",
            "method": "POST",
            "body": huge_body,
        })
        assert resp.status_code in (413, 422)  # 413 from middleware or 422 from Pydantic

    @pytest.mark.asyncio
    async def test_codegen_method_max_length(self, client):
        resp = await client.post("/api/v1/codegen", json={
            "method": "X" * 20,
            "url": "https://api.example.com",
        })
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════════════
# Security Headers & Secret Masking Tests
# ═══════════════════════════════════════════════════════════════════════

class TestSecurityHeaders:
    """Test that security headers middleware adds all required headers."""

    @pytest.mark.asyncio
    async def test_security_headers_present(self, client):
        resp = await client.get("/")
        assert resp.headers.get("x-content-type-options") == "nosniff"
        assert resp.headers.get("x-frame-options") == "DENY"
        assert resp.headers.get("x-xss-protection") == "1; mode=block"
        assert "content-security-policy" in resp.headers
        assert "permissions-policy" in resp.headers


class TestSecretMasking:
    """Test the SecretMaskingFilter."""

    def test_masks_api_key_in_log(self):
        from app.core.security import SecretMaskingFilter
        f = SecretMaskingFilter()
        assert "***MASKED***" in f._mask("key=" + "AIzaSyD" + "1234567890" * 3)

    def test_masks_jwt_in_log(self):
        from app.core.security import SecretMaskingFilter
        f = SecretMaskingFilter()
        masked = f._mask("token " + ".".join(["eyJ" + "a" * 20, "b" * 20, "c" * 20]))
        assert "***MASKED***" in masked

    def test_does_not_mask_normal_text(self):
        from app.core.security import SecretMaskingFilter
        f = SecretMaskingFilter()
        text = "GET /api/users returned 200 OK"
        assert f._mask(text) == text


# ═══════════════════════════════════════════════════════════════════════
# OAuth Route Tests
# ═══════════════════════════════════════════════════════════════════════

class TestOAuthRoutes:
    """Test OAuth helper endpoints."""

    @pytest.mark.asyncio
    async def test_oauth_state_returns_token(self, client):
        resp = await client.get("/api/v1/oauth/state")
        assert resp.status_code == 200
        data = resp.json()
        assert "state" in data
        # State format: nonce:timestamp:signature
        parts = data["state"].split(":")
        assert len(parts) == 3

    @pytest.mark.asyncio
    async def test_oauth_state_unique_each_call(self, client):
        resp1 = await client.get("/api/v1/oauth/state")
        resp2 = await client.get("/api/v1/oauth/state")
        assert resp1.json()["state"] != resp2.json()["state"]


# ═══════════════════════════════════════════════════════════════════════
# Root / Health Check
# ═══════════════════════════════════════════════════════════════════════

class TestHealthCheck:
    """Test root endpoint."""

    @pytest.mark.asyncio
    async def test_root_returns_status(self, client):
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert "TestOrbit" in data["message"]
        assert "version" in data
        assert "uptime_seconds" in data

    @pytest.mark.asyncio
    async def test_root_dev_includes_extra_info(self, client):
        """In dev mode, root endpoint shows services and docs link."""
        resp = await client.get("/")
        data = resp.json()
        assert "services" in data
        assert "docs" in data
        assert data["services"]["gemini"] in ("configured", "missing_key")


# ═══════════════════════════════════════════════════════════════════════
# PinnedResolver Tests
# ═══════════════════════════════════════════════════════════════════════

class TestPinnedResolver:
    """Test DNS pinning resolver for SSRF prevention."""

    @pytest.mark.asyncio
    async def test_resolves_pinned_host(self):
        import socket
        from app.core.security import PinnedResolver
        resolver = PinnedResolver("example.com", [("93.184.216.34", socket.AF_INET)])
        results = await resolver.resolve("example.com", 443)
        assert len(results) == 1
        assert results[0]["host"] == "93.184.216.34"

    @pytest.mark.asyncio
    async def test_rejects_unknown_host(self):
        from app.core.security import PinnedResolver
        resolver = PinnedResolver("example.com", [("93.184.216.34", 2)])
        with pytest.raises(OSError):
            await resolver.resolve("evil.com", 443)

    @pytest.mark.asyncio
    async def test_close_is_noop(self):
        from app.core.security import PinnedResolver
        resolver = PinnedResolver("x.com", [])
        await resolver.close()  # Should not raise
