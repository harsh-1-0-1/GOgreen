#!/usr/bin/env sh
set -e

echo "Running database migrations..."
alembic upgrade head || echo "alembic upgrade failed"

echo "Seeding database..."
python seed.py || echo "seed script failed or no-op"

echo "Starting server..."
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
