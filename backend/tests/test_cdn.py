from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from starlette.requests import Request

from app.core.cdn import get_real_client_ip
from app.core.config import Settings


def _request(headers: dict[str, str] | None = None, client: tuple[str, int] | None = None) -> Request:
    raw_headers = [
        (name.lower().encode(), value.encode())
        for name, value in (headers or {}).items()
    ]
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": raw_headers,
            "client": client,
        }
    )


def test_cloudfront_enforcement_requires_a_secret():
    with pytest.raises(ValidationError, match="CLOUDFRONT_SECRET must be set"):
        Settings(REQUIRE_CLOUDFRONT=True, CLOUDFRONT_SECRET="")


def test_client_ip_uses_cloudfront_viewer_address_when_enforced():
    request = _request(
        headers={"CloudFront-Viewer-Address": "203.0.113.7:49152"},
        client=("10.0.0.1", 1234),
    )
    with patch("app.core.cdn.settings.REQUIRE_CLOUDFRONT", True):
        assert get_real_client_ip(request) == "203.0.113.7"


def test_client_ip_parses_bracketed_ipv6():
    request = _request(headers={"CloudFront-Viewer-Address": "[2001:db8::1]:443"})
    with patch("app.core.cdn.settings.REQUIRE_CLOUDFRONT", True):
        assert get_real_client_ip(request) == "2001:db8::1"


def test_client_ip_ignores_cloudfront_header_when_enforcement_is_off():
    request = _request(
        headers={"CloudFront-Viewer-Address": "203.0.113.7:49152"},
        client=("127.0.0.1", 1234),
    )
    with patch("app.core.cdn.settings.REQUIRE_CLOUDFRONT", False):
        assert get_real_client_ip(request) == "127.0.0.1"


@pytest.mark.asyncio
async def test_gate_blocks_direct_origin_but_exempts_health(client):
    from main import app, limiter

    limiter.enabled = False
    transport = ASGITransport(app=app)
    try:
        with (
            patch("app.api.middleware.settings.REQUIRE_CLOUDFRONT", True),
            patch("app.api.middleware.settings.CLOUDFRONT_SECRET", "test-secret"),
        ):
            async with AsyncClient(transport=transport, base_url="http://test") as direct_client:
                blocked = await direct_client.get("/api/v1/products")
                health = await direct_client.get("/api/v1/health")
                allowed = await direct_client.get(
                    "/api/v1/products",
                    headers={
                        "X-Origin-Verify": "test-secret",
                        "CloudFront-Viewer-Address": "203.0.113.7:49152",
                    },
                )

        assert blocked.status_code == 403
        assert health.status_code == 200
        assert allowed.status_code == 200
    finally:
        limiter.enabled = True
