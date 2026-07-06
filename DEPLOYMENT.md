# Deploy the Backend on Render, the Frontend on Vercel, and CloudFront in Front

This repository is a monorepo:

- `backend/`: FastAPI API deployed as a Render Docker web service
- `frontend/`: Vite React app deployed on Vercel
- `render.yaml`: optional Render Blueprint for the backend service

## 1. Deploy the backend to Render

Create the service from `render.yaml`, or configure the same settings in the Render dashboard:

- Runtime: Docker
- Dockerfile: `backend/Dockerfile`
- Docker build context: `backend`
- Health check path: `/api/v1/health`

Set the database, Redis, authentication, Cloudinary, Google, PayU, and CORS variables from `.env.example`. Keep CloudFront enforcement off during the first deployment:

```env
REQUIRE_CLOUDFRONT=false
CLOUDFRONT_SECRET=
BACKEND_PUBLIC_URL=https://your-service.onrender.com
CORS_ORIGINS=https://your-frontend.vercel.app
CORS_ORIGIN_REGEX=
DEBUG=false
LOG_JSON=true
```

Confirm these requests work before creating the distribution:

```text
https://your-service.onrender.com/api/v1/health
https://your-service.onrender.com/api/v1/products
```

## 2. Create the CloudFront distribution

Use the following origin settings:

- Origin domain: `your-service.onrender.com` (no protocol prefix)
- Origin protocol: HTTPS only
- Custom origin header: `X-Origin-Verify: <a generated 64-character hex secret>`

Generate a secret locally:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Create a custom origin request policy that forwards:

- Viewer headers: `Authorization`, `Origin`, `Access-Control-Request-Headers`,
  `Access-Control-Request-Method`, and `X-Cart-Session-Id`
- CloudFront header: `CloudFront-Viewer-Address`
- All query strings
- No cookies

Do not add `X-Origin-Verify` to the origin request policy. It is already configured as a static custom origin header and CloudFront adds it to origin requests.

Configure the cache behaviors in this order:

| Path pattern | Allowed methods | Cached methods | Cache policy |
|---|---|---|---|
| `/api/v1/products*` | All | GET, HEAD | Custom public API policy |
| `/api/v1/categories*` | All | GET, HEAD | Custom public API policy |
| Default `/*` | All | None | `CachingDisabled` |

The custom public API cache policy should use:

- Minimum TTL: `0`
- Default TTL: `60`
- Maximum TTL: `300`
- Query strings in cache key: all
- Authorization in cache key: no

The API sends `Cache-Control: public, max-age=300, stale-while-revalidate=60` for list responses and `public, max-age=60` for detail responses. Product and category writes are allowed through the public path behaviors, but CloudFront only caches GET and HEAD responses.

If more than one browser origin is allowed, include `Origin` in the cache key or configure an appropriate CloudFront CORS response policy.

## 3. Enable CloudFront enforcement on Render

After CloudFront reports that the distribution is deployed, update Render:

```env
REQUIRE_CLOUDFRONT=true
CLOUDFRONT_SECRET=<the same secret configured on the CloudFront origin>
BACKEND_PUBLIC_URL=https://d1234abc.cloudfront.net
GOOGLE_REDIRECT_URI=https://d1234abc.cloudfront.net/api/v1/auth/google/callback
```

The application refuses to start if enforcement is enabled without a secret. `BACKEND_PUBLIC_URL` must use CloudFront because it is used to generate PayU callback URLs.

## 4. Deploy the frontend to Vercel

Set:

```env
VITE_API_BASE_URL=https://d1234abc.cloudfront.net/api/v1
```

Redeploy the Vercel project after changing this build-time variable.

## 5. Verify the deployment

- CloudFront `/api/v1/products` returns product data.
- Different product query strings return their corresponding results.
- Raw Render `/api/v1/products` returns `403`.
- Raw Render `/api/v1/health` returns `200` for Render health checks.
- Cart, address, order, authentication, and admin GET responses are not cached.
- Admin product and category writes work through CloudFront.
- PayU callbacks and Google OAuth redirects use the CloudFront hostname.

CloudFront responses can remain stale for up to their configured TTL after an admin mutation. This version intentionally relies on the short TTL instead of issuing CloudFront invalidations.

## 6. Promote an administrator

Open a Render shell for the backend and run `uv run python`, then execute:

```python
import asyncio
from sqlalchemy import update
from app.db.session import async_session_factory
from app.db.models import User

async def promote(email: str):
    async with async_session_factory() as db:
        await db.execute(
            update(User).where(User.email == email).values(is_admin=True)
        )
        await db.commit()

asyncio.run(promote("your-email@example.com"))
```
