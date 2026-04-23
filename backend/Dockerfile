FROM python:3.12-slim AS base

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libffi-dev && \
    rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir . && \
    pip install --no-cache-dir gunicorn

COPY . .

RUN mkdir -p static/banners

COPY start.sh .
RUN chmod +x start.sh

EXPOSE ${PORT:-8000}

CMD ["./start.sh"]
