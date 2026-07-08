from ipaddress import ip_address

from fastapi import Request

from app.core.config import settings

CLOUDFRONT_VIEWER_ADDRESS = "CloudFront-Viewer-Address"


def _parse_cloudfront_viewer_address(value: str) -> str | None:
    """Return the IP portion of CloudFront's ``IP:port`` viewer header."""
    candidate = value.strip()
    if not candidate:
        return None

    if candidate.startswith("["):
        closing_bracket = candidate.find("]")
        if closing_bracket == -1:
            return None
        candidate = candidate[1:closing_bracket]
    else:
        host, separator, port = candidate.rpartition(":")
        if separator and host and port.isdigit():
            candidate = host

    try:
        return str(ip_address(candidate))
    except ValueError:
        return None


def get_real_client_ip(request: Request) -> str:
    """Return a trusted viewer IP for rate limiting and security checks."""
    if settings.REQUIRE_CLOUDFRONT:
        viewer_ip = _parse_cloudfront_viewer_address(
            request.headers.get(CLOUDFRONT_VIEWER_ADDRESS, "")
        )
        return viewer_ip or "unknown-cloudfront-viewer"

    if request.client:
        return request.client.host
    return "unknown-client"
