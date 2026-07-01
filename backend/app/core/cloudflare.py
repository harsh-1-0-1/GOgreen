from fastapi import Request

def get_real_client_ip(request: Request) -> str:
    """
    Get the real client IP, falling back through proxies.
    Suitable for use with slowapi rate limiting.
    """
    # 1. Cloudflare's specific header
    if "CF-Connecting-IP" in request.headers:
        return request.headers["CF-Connecting-IP"]
    
    # 2. General proxy header (takes the first IP in the list)
    if "X-Forwarded-For" in request.headers:
        return request.headers["X-Forwarded-For"].split(",")[0].strip()
    
    # 3. Fallback to direct client (which might be Cloudflare/Envoy if proxy headers are missing)
    if request.client:
        return request.client.host
    return "127.0.0.1"
