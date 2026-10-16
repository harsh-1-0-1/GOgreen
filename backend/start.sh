#!/usr/bin/env sh
set -e

WAIT_RETRIES=${WAIT_RETRIES:-60}
WAIT_SLEEP=${WAIT_SLEEP:-2}

echo "Waiting for database to become available (max ${WAIT_RETRIES} attempts)..."
uv run python - <<PY || exit 1
import os, sys, time, asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

url = os.environ.get('DATABASE_URL')
if not url:
	print('DATABASE_URL not set')
	sys.exit(1)
if url.startswith('postgres://'):
	url = url.replace('postgres://', 'postgresql+asyncpg://', 1)
elif url.startswith('postgresql://'):
	url = url.replace('postgresql://', 'postgresql+asyncpg://', 1)

async def check(url):
	engine = create_async_engine(url, future=True)
	try:
		async with engine.connect() as conn:
			await conn.execute(text('SELECT 1'))
		await engine.dispose()
		return True
	except Exception as e:
		print('DB check failed:', e)
		try:
			await engine.dispose()
		except Exception:
			pass
		return False

attempts = int(os.environ.get('WAIT_RETRIES', '60'))
sleep = int(os.environ.get('WAIT_SLEEP', '2'))
for i in range(attempts):
	if asyncio.get_event_loop().run_until_complete(check(url)):
		print('Database is available')
		sys.exit(0)
	print(f'Attempt {i+1}/{attempts} failed — retrying in {sleep}s...')
	time.sleep(sleep)
print('Database did not become available in time')
sys.exit(1)
PY

echo "Running database migrations..."
uv run alembic upgrade head || echo "alembic upgrade failed"

echo "Starting server..."
exec uv run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
