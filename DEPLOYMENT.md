# Deploy Backend on Railway and Frontend on Vercel

This repo is a monorepo:

- Backend: `backend/` FastAPI service
- Frontend: `frontend/` Vite React app

## 1. Push This Repo to GitHub

Railway and Vercel both deploy most cleanly from GitHub.

## 2. Railway Backend

Create a new Railway project, then add these services:

1. Add a PostgreSQL database.
2. Add a Redis database.
3. Add a GitHub repo service for this project.

Backend service settings:

- Root Directory: `/backend`
- Config File Path: `/backend/railway.json`
- Builder: Dockerfile, already configured by `backend/railway.json`
- Start Command: leave blank, so Railway uses the Dockerfile `CMD`
- Healthcheck Path: `/api/v1/health`

The backend Dockerfile reads Railway's `PORT` variable automatically. Database migrations run from the `preDeployCommand` in `backend/railway.json`.

Set these backend variables in Railway:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
SECRET_KEY=replace-with-a-long-random-secret
BACKEND_PUBLIC_URL=https://your-railway-backend-domain
CORS_ORIGINS=https://your-vercel-frontend-domain
CORS_ORIGIN_REGEX=
LOG_JSON=true
DEBUG=false
```

`CORS_ORIGINS` is the main control for which frontend sites can call the backend. It can be a single URL, comma-separated URLs, or a JSON array string. These are all valid:

```env
CORS_ORIGINS=https://your-vercel-frontend-domain
CORS_ORIGINS=https://first.vercel.app,https://second.vercel.app
CORS_ORIGINS=["https://your-vercel-frontend-domain"]
```

For Vercel preview deployments, you can either add each preview URL to `CORS_ORIGINS`, or use:

```env
CORS_ORIGIN_REGEX=https://.*\.vercel\.app
```

For the tightest production setup, keep `CORS_ORIGIN_REGEX` empty and list only your real production frontend URL in `CORS_ORIGINS`.

Optional variables:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-railway-backend-domain/api/v1/auth/google/callback
PAYU_KEY=
PAYU_SALT=
```

Do not put `uv run alembic upgrade head` in Railway's Start Command. It is a one-off migration command and exits immediately, which prevents the HTTP server from starting.

Optional sample data:

```bash
uv run python seed.py
```

Check:

```text
https://your-railway-backend-domain/api/v1/health
```

## 3. Vercel Frontend

Create a Vercel project from the same GitHub repo.

Frontend project settings:

- Framework Preset: Vite
- Root Directory: `frontend`
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: `dist`

Set this Vercel environment variable:

```env
VITE_API_BASE_URL=https://your-railway-backend-domain/api/v1
```

This is the frontend's only required backend connection setting. If the backend moves to a different Railway domain later, update this variable in Vercel and redeploy the frontend.

The file `frontend/vercel.json` is already included so React Router deep links work on Vercel.

## 4. Connect Both Domains

After Vercel gives you a production URL:

1. Update Railway `CORS_ORIGINS` to the exact Vercel URL.
2. Leave Railway `CORS_ORIGIN_REGEX` empty unless you want Vercel preview deploys to call the backend.
3. Redeploy Railway.
4. Confirm the frontend can call the backend.

After Railway gives you a backend URL:

1. Update Vercel `VITE_API_BASE_URL`.
2. Redeploy Vercel.

## 5. Admin User

Register a user through the frontend, then promote that user to admin from the Railway backend shell:

```bash
uv run python
```

Then paste:

```python
import asyncio
from sqlalchemy import update
from app.db.session import async_session_factory
from app.db.models import User

async def promote(email: str):
    async with async_session_factory() as db:
        await db.execute(update(User).where(User.email == email).values(is_admin=True))
        await db.commit()
        print(f"Done: {email} is now an admin")

asyncio.run(promote("your-email@example.com"))
```
