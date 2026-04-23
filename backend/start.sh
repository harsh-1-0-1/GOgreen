#!/bin/sh
set -e

if [ -n "$RAILWAY_VOLUME_MOUNT_PATH" ]; then
    DB_DIR="$RAILWAY_VOLUME_MOUNT_PATH"
    mkdir -p "$DB_DIR"

    if [ ! -f "$DB_DIR/gogreen.db" ] && [ -f /app/gogreen.db ]; then
        echo "Seeding database from bundled gogreen.db"
        cp /app/gogreen.db "$DB_DIR/gogreen.db"
    fi
fi

echo "Running migrations..."
python -m alembic upgrade head

echo "Starting server on port ${PORT:-8000}..."
exec gunicorn main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers 2 \
    --timeout 120
