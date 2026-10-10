"""Regression tests for open-source security review findings; no external services."""
import io
import json
import logging
import socket
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings, get_settings
from app.core.security import (
    _decode_hs256, read_bounded_response, safe_request, validate_proxy_url,
)


@pytest.mark.parametrize("environment", ["production", "staging"])
def test_shared_deployments_cannot_disable_auth(environment):
    with pytest.raises(ValueError, match="Authentication is required"):
        Settings(_env_file=None, GEMINI_API_KEY="fixture", ENV=environment,
                 SUPABASE_URL="https://example.supabase.co", REQUIRE_AUTH=False)


def test_unknown_environment_cannot_disable_ssrf():
    with pytest.raises(ValueError, match="ENV must be"):
        Settings(_env_file=None, GEMINI_API_KEY="fixture", ENV="prod")


@pytest.mark.asyncio
@pytest.mark.parametrize("address", ["::ffff:127.0.0.1", "100.64.0.1", "224.0.0.1", "169.254.169.254"])
async def test_ssrf_blocks_non_public_ranges(monkeypatch, address):
    monkeypatch.setattr(get_settings(), "ENV", "production")
    family = socket.AF_INET6 if ":" in address else socket.AF_INET
    with patch("socket.getaddrinfo", return_value=[(family, 1, 6, "", (address, 443))]):
        with pytest.raises(HTTPException) as exc:
            await validate_proxy_url("https://example.com/resource")
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_safe_request_pins_dns_and_disables_redirects():
    response = SimpleNamespace(status=302)
    response_ctx = AsyncMock()
    response_ctx.__aenter__.return_value = response
    session = MagicMock()
    session.request.return_value = response_ctx
    session_ctx = AsyncMock()
    session_ctx.__aenter__.return_value = session
    addresses = [("93.184.216.34", socket.AF_INET)]
    with patch("app.core.security.validate_proxy_url", AsyncMock(return_value=("example.com", addresses))), \
         patch("aiohttp.TCPConnector") as connector, \
         patch("aiohttp.ClientSession", return_value=session_ctx):
        async with safe_request("GET", "https://example.com") as actual:
            assert actual.status == 302
        resolver = connector.call_args.kwargs["resolver"]
        assert (await resolver.resolve("example.com", 443))[0]["host"] == addresses[0][0]
        with pytest.raises(OSError):
            await resolver.resolve("attacker.example", 443)
    assert session.request.call_args.kwargs["allow_redirects"] is False


@pytest.mark.asyncio
async def test_response_limit_is_enforced_during_streaming():
    async def chunks(_size):
        yield b"a" * 4
        yield b"b" * 4
        raise AssertionError("Must stop consuming after the size limit")
    response = SimpleNamespace(content=SimpleNamespace(iter_chunked=chunks))
    with pytest.raises(HTTPException) as exc:
        await read_bounded_response(response, limit=5)
    assert exc.value.status_code == 502


def test_jwt_without_expiry_is_rejected():
    key = "fixture-only-" * 4
    token = jwt.encode({"sub": "user", "aud": "authenticated"}, key, algorithm="HS256")
    with pytest.raises(HTTPException) as exc:
        _decode_hs256(token, key)
    assert exc.value.status_code == 401


def test_child_logger_masks_arguments_exceptions_and_extra_fields():
    from app.core.logging import JSONFormatter
    from app.core.security import SecretMaskingFilter
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.addFilter(SecretMaskingFilter())
    handler.setFormatter(JSONFormatter())
    logger = logging.getLogger("audit.regression.child")
    logger.handlers = [handler]
    logger.propagate = False
    logger.setLevel(logging.INFO)
    secret = "fixture-value-" + "z" * 25
    try:
        raise RuntimeError("password=" + secret)
    except RuntimeError:
        logger.exception("token=%(token)s", {"token": secret}, extra={"url": "https://example.com?api_key=" + secret})
    output = stream.getvalue()
    assert secret not in output
    assert "MASKED" in output
    assert json.loads(output)["level"] == "ERROR"


def test_mock_owners_cannot_read_delete_or_clear_each_others_data(tmp_path, monkeypatch):
    import app.services.mock_service as module
    monkeypatch.setattr(module, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(module, "MOCKS_FILE", str(tmp_path / "mocks.json"))
    service = module.MockService()
    service.add_mock("GET", "same-path", {"owner": "alice"}, "alice")
    service.add_mock("GET", "same-path", {"owner": "bob"}, "bob")
    assert service.get_mock("GET", "same-path", "alice") == {"owner": "alice"}
    assert service.get_mock("GET", "same-path", "mallory") is None
    assert service.list_mocks("mallory") == []
    assert not service.delete_mock("GET", "same-path", "mallory")
    service.clear_mocks("alice")
    reloaded = module.MockService()
    assert reloaded.get_mock("GET", "same-path", "alice") is None
    assert reloaded.get_mock("GET", "same-path", "bob") == {"owner": "bob"}


@pytest.mark.asyncio
async def test_mock_generation_requires_auth(monkeypatch):
    from app.main import app
    monkeypatch.setattr(get_settings(), "REQUIRE_AUTH", True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/mock-server/private-example")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_retired_billing_route_is_unavailable():
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/razorpay/create-subscription")
    assert response.status_code == 404
