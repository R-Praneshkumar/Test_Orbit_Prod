"""
TestOrbit Backend Test Suite

Tests cover:
- MockService: CRUD operations, persistence, clear
- OAuth routes: token exchange, refresh, validation
- Core config: settings loading
- Structured logging: JSON formatter, request ID context
"""
import json
import os
import sys
import tempfile
import pytest

# Add backend root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ------------------------------------------------------------------
# MockService Tests (unit tests — no server needed)
# ------------------------------------------------------------------
class TestMockService:
    """Test mock CRUD and JSON persistence."""

    def _make_service(self, tmp_dir):
        """Create a MockService with a custom data dir."""
        import app.services.mock_service as ms

        # Monkey-patch the file path to use a temp dir
        ms.DATA_DIR = tmp_dir
        ms.MOCKS_FILE = os.path.join(tmp_dir, "mocks.json")

        return ms.MockService()

    def test_add_and_get_mock(self, tmp_path):
        svc = self._make_service(str(tmp_path))
        svc.add_mock("GET", "/api/users", {"users": []})
        assert svc.get_mock("GET", "/api/users") == {"users": []}

    def test_get_nonexistent_mock(self, tmp_path):
        svc = self._make_service(str(tmp_path))
        assert svc.get_mock("POST", "/nope") is None

    def test_list_mocks(self, tmp_path):
        svc = self._make_service(str(tmp_path))
        svc.add_mock("GET", "/a", {"a": 1})
        svc.add_mock("POST", "/b", {"b": 2})
        listing = svc.list_mocks()
        assert len(listing) == 2
        methods = {m["method"] for m in listing}
        assert methods == {"GET", "POST"}

    def test_delete_mock(self, tmp_path):
        svc = self._make_service(str(tmp_path))
        svc.add_mock("GET", "/to-delete", {"ok": True})
        assert svc.delete_mock("GET", "/to-delete") is True
        assert svc.get_mock("GET", "/to-delete") is None
        # Deleting again returns False
        assert svc.delete_mock("GET", "/to-delete") is False

    def test_clear_mocks(self, tmp_path):
        svc = self._make_service(str(tmp_path))
        svc.add_mock("GET", "/x", {})
        svc.add_mock("POST", "/y", {})
        svc.clear_mocks()
        assert len(svc.list_mocks()) == 0

    def test_persistence_save_and_load(self, tmp_path):
        import app.services.mock_service as ms

        ms.DATA_DIR = str(tmp_path)
        ms.MOCKS_FILE = os.path.join(str(tmp_path), "mocks.json")

        svc1 = ms.MockService()
        svc1.add_mock("PUT", "/api/item", {"updated": True})

        # New service instance should load from file
        svc2 = ms.MockService()
        assert svc2.get_mock("PUT", "/api/item") == {"updated": True}

    def test_persistence_file_format(self, tmp_path):
        svc = self._make_service(str(tmp_path))
        svc.add_mock("GET", "/test", {"hello": "world"})

        mocks_file = os.path.join(str(tmp_path), "mocks.json")
        assert os.path.exists(mocks_file)

        with open(mocks_file) as f:
            data = json.load(f)
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["method"] == "GET"
        assert data[0]["path"] == "/test"
        assert "created_at" in data[0]

    def test_clear_removes_file(self, tmp_path):
        svc = self._make_service(str(tmp_path))
        svc.add_mock("GET", "/tmp", {})
        mocks_file = os.path.join(str(tmp_path), "mocks.json")
        assert os.path.exists(mocks_file)
        svc.clear_mocks()
        assert not os.path.exists(mocks_file)

    def test_method_case_insensitive(self, tmp_path):
        svc = self._make_service(str(tmp_path))
        svc.add_mock("get", "/case", {"ok": True})
        # Internally stored as uppercase
        assert svc.get_mock("GET", "/case") == {"ok": True}


# ------------------------------------------------------------------
# OAuth Route Model Tests (Pydantic validation)
# ------------------------------------------------------------------
class TestOAuthModels:
    """Test Pydantic request models for OAuth routes."""

    def test_token_request_valid(self):
        from app.api.oauth_routes import TokenRequest

        req = TokenRequest(
            grant_type="client_credentials",
            token_url="https://example.com/oauth/token",
            client_id="my-client",
            client_secret="secret123",
        )
        assert req.grant_type == "client_credentials"
        assert req.client_id == "my-client"

    def test_token_request_auth_code(self):
        from app.api.oauth_routes import TokenRequest

        req = TokenRequest(
            grant_type="authorization_code",
            token_url="https://example.com/oauth/token",
            client_id="my-client",
            code="abc123",
            redirect_uri="http://localhost:5173/oauth/callback",
        )
        assert req.code == "abc123"
        assert req.redirect_uri is not None

    def test_refresh_request_valid(self):
        from app.api.oauth_routes import RefreshRequest

        req = RefreshRequest(
            token_url="https://example.com/oauth/token",
            client_id="my-client",
            refresh_token="rt-abc",
        )
        assert req.refresh_token == "rt-abc"


# ------------------------------------------------------------------
# Config Tests
# ------------------------------------------------------------------
class TestConfig:
    """Test core config loading."""

    def test_settings_defaults(self, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", "test-key-123")
        # Clear lru_cache so settings reload with env var
        from app.core.config import get_settings
        get_settings.cache_clear()
        s = get_settings()
        assert s.PROJECT_NAME == "TestOrbit"
        assert s.API_V1_STR == "/api/v1"

    def test_cors_origins(self, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", "test-key-123")
        from app.core.config import get_settings
        get_settings.cache_clear()
        s = get_settings()
        assert isinstance(s.BACKEND_CORS_ORIGINS, list)
        assert len(s.BACKEND_CORS_ORIGINS) > 0


# ------------------------------------------------------------------
# Structured Logging Tests
# ------------------------------------------------------------------
class TestStructuredLogging:
    """Test JSON formatter and request ID context vars."""

    def test_json_formatter_output(self):
        import logging
        from io import StringIO
        from app.core.logging import JSONFormatter

        stream = StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(JSONFormatter())
        logger = logging.getLogger("test.json_formatter")
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)

        logger.info("hello world")

        output = stream.getvalue().strip()
        parsed = json.loads(output)
        assert parsed["level"] == "INFO"
        assert parsed["message"] == "hello world"
        assert parsed["logger"] == "test.json_formatter"
        assert "timestamp" in parsed
        assert "request_id" in parsed

        logger.removeHandler(handler)

    def test_json_formatter_with_extra_fields(self):
        import logging
        from io import StringIO
        from app.core.logging import JSONFormatter

        stream = StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(JSONFormatter())
        logger = logging.getLogger("test.extra_fields")
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)

        logger.info(
            "request done",
            extra={"method": "POST", "url": "/api/v1/chat", "status": 200, "duration_ms": 42.5},
        )

        output = stream.getvalue().strip()
        parsed = json.loads(output)
        assert parsed["method"] == "POST"
        assert parsed["url"] == "/api/v1/chat"
        assert parsed["status"] == 200
        assert parsed["duration_ms"] == 42.5

        logger.removeHandler(handler)

    def test_request_id_context_var(self):
        from app.core.logging import request_id_var, user_id_var

        # Default values
        assert request_id_var.get("-") == "-"
        assert user_id_var.get("-") == "-"

        # Set and get
        token1 = request_id_var.set("abc123")
        token2 = user_id_var.set("user-42")
        assert request_id_var.get() == "abc123"
        assert user_id_var.get() == "user-42"

        # Reset
        request_id_var.reset(token1)
        user_id_var.reset(token2)

    def test_json_formatter_includes_request_id(self):
        import logging
        from io import StringIO
        from app.core.logging import JSONFormatter, request_id_var

        token = request_id_var.set("req-xyz")
        try:
            stream = StringIO()
            handler = logging.StreamHandler(stream)
            handler.setFormatter(JSONFormatter())
            logger = logging.getLogger("test.request_id_in_log")
            logger.addHandler(handler)
            logger.setLevel(logging.DEBUG)

            logger.info("test message")

            parsed = json.loads(stream.getvalue().strip())
            assert parsed["request_id"] == "req-xyz"

            logger.removeHandler(handler)
        finally:
            request_id_var.reset(token)

    def test_json_formatter_with_exception(self):
        import logging
        from io import StringIO
        from app.core.logging import JSONFormatter

        stream = StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(JSONFormatter())
        logger = logging.getLogger("test.exception")
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)

        try:
            raise ValueError("test error")
        except ValueError:
            logger.exception("something failed")

        parsed = json.loads(stream.getvalue().strip())
        assert parsed["level"] == "ERROR"
        assert "exception" in parsed
        assert "ValueError: test error" in parsed["exception"]

        logger.removeHandler(handler)

    def test_extract_user_hint(self):
        """Test _extract_user_hint with a real-ish JWT payload."""
        import base64
        from app.core.logging import _extract_user_hint
        from unittest.mock import MagicMock

        # Build a fake JWT with sub claim
        header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256"}).encode()).rstrip(b"=").decode()
        payload = base64.urlsafe_b64encode(json.dumps({"sub": "user-123"}).encode()).rstrip(b"=").decode()
        fake_jwt = f"{header}.{payload}.fakesig"

        request = MagicMock()
        request.headers = {"authorization": f"Bearer {fake_jwt}"}
        assert _extract_user_hint(request) == "user-123"

        # No auth header
        request.headers = {}
        assert _extract_user_hint(request) == "-"

        # Invalid token
        request.headers = {"authorization": "Bearer not-a-jwt"}
        assert _extract_user_hint(request) == "-"

    def test_get_client_ip(self):
        from app.core.logging import _get_client_ip
        from unittest.mock import MagicMock

        request = MagicMock()

        # With X-Forwarded-For
        request.headers = {"x-forwarded-for": "1.2.3.4, 10.0.0.1"}
        assert _get_client_ip(request) == "1.2.3.4"

        # Without proxy header, use client.host
        request.headers = {}
        request.client.host = "5.6.7.8"
        assert _get_client_ip(request) == "5.6.7.8"


# ------------------------------------------------------------------
# Digest Service Tests
# ------------------------------------------------------------------
class TestDigestService:
    """Test weekly digest email builder and sender."""

    def test_build_digest_html_returns_expected_keys(self):
        from app.services.digest_service import build_digest_html

        result = build_digest_html()
        assert "subject" in result
        assert "html" in result
        assert "stats" in result
        assert "period" in result

    def test_build_digest_html_subject_format(self):
        from app.services.digest_service import build_digest_html

        result = build_digest_html()
        assert result["subject"].startswith("TestOrbit Weekly Digest")

    def test_build_digest_html_stats_keys(self):
        from app.services.digest_service import build_digest_html

        stats = build_digest_html()["stats"]
        expected_keys = {"active_users", "ai_calls", "test_gen", "code_gen", "security_scan", "total_actions"}
        assert set(stats.keys()) == expected_keys

    def test_build_digest_html_contains_testorbit(self):
        from app.services.digest_service import build_digest_html

        html = build_digest_html()["html"]
        assert "TestOrbit" in html
        assert "Activity Summary" in html

    def test_build_digest_custom_period_label(self):
        from app.services.digest_service import build_digest_html

        result = build_digest_html(period_label="Last 7 Days")
        assert "Last 7 Days" in result["html"]

    @pytest.mark.asyncio
    async def test_send_digest_no_api_key(self):
        """Without RESEND_API_KEY configured, send should return gracefully."""
        from app.services.digest_service import send_digest_email

        result = await send_digest_email(["test@example.com"])
        assert result["sent"] is False
        assert "RESEND_API_KEY" in result["error"]

    @pytest.mark.asyncio
    async def test_send_digest_no_recipients(self):
        from app.services.digest_service import send_digest_email

        result = await send_digest_email([])
        assert result["sent"] is False
        assert "No recipients" in result["error"]
