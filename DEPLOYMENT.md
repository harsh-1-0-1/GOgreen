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
- Healthcheck Path: `/api/v1/health`

The backend Dockerfile reads Railway's `PORT` variable automatically.

Set these backend variables in Railway:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
SECRET_KEY=replace-with-a-long-random-secret
BACKEND_PUBLIC_URL=https://your-railway-backend-domain
CORS_ORIGINS=https://your-vercel-frontend-domain
LOG_JSON=true
DEBUG=false
```

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

After the backend deploys, open the Railway backend service shell and run:

```bash
uv run alembic upgrade head
```

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

The file `frontend/vercel.json` is already included so React Router deep links work on Vercel.

## 4. Connect Both Domains

After Vercel gives you a production URL:

1. Update Railway `CORS_ORIGINS` to the exact Vercel URL.
2. Redeploy Railway.
3. Confirm the frontend can call the backend.

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
