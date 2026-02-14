"""
TestOrbit Backend Test Suite

Tests cover:
- MockService: CRUD operations, persistence, clear
- OAuth routes: token exchange, refresh, validation
- Core config: settings loading
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
