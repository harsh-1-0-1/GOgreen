"""Timing / payload benchmark for the image-variant pipeline.

Run with output visible:

    uv run pytest tests/test_image_variants_timing.py -s

These tests assert correctness (sizes, no upscale, files written) and *print*
timings so a slow upload/fetch regresses loudly without making CI flaky on
absolute wall-clock numbers.
"""

import io
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen

import pytest
from fastapi import UploadFile
from PIL import Image, ImageDraw

from app.core.config import settings
from app.utils import image_upload


@pytest.fixture(scope="module")
def sample_jpeg() -> bytes:
    """A 2400x1600 photo-like JPEG (gradient + shapes) so WebP has real work."""
    width, height = 2400, 1600
    image = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(image)
    for y in range(height):
        draw.line([(0, y), (width, y)], fill=(30 + y % 200, 120 + y % 100, 60 + y % 150))
    for i in range(80):
        x = (i * 97) % width
        y = (i * 53) % height
        draw.ellipse(
            [x, y, x + 220, y + 220],
            fill=((i * 13) % 255, (i * 29) % 255, (i * 7) % 255),
        )
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


def _kb(n: int) -> str:
    return f"{n / 1024:.1f} KB"


def _report(label: str, rows: list[tuple[str, int]], elapsed_ms: float | None = None) -> None:
    print(f"\n[{label}]")
    if elapsed_ms is not None:
        print(f"  generate+encode: {elapsed_ms:.1f} ms")
    for name, size in rows:
        print(f"  {name:<10} {_kb(size):>10}")


def test_variant_generation_timing_and_savings(sample_jpeg: bytes) -> None:
    sizes = image_upload.variants_for("products")

    started = time.perf_counter()
    variants = image_upload.make_variants(sample_jpeg, sizes)
    elapsed_ms = (time.perf_counter() - started) * 1000

    assert set(variants) == {"thumb", "card", "detail"}
    encoded = {name: len(data) for name, data in variants.items()}
    _report(
        "make_variants (products)",
        [("original", len(sample_jpeg)), *encoded.items()],
        elapsed_ms,
    )

    for name, data in variants.items():
        image = Image.open(io.BytesIO(data))
        assert image.format == "WEBP"
        assert image.width == sizes[name]
        assert len(data) < len(sample_jpeg), f"{name} not smaller than original"

    # A source narrower than the targets is clamped, never upscaled: every
    # advertised variant is still emitted, at most at the source width.
    tiny = io.BytesIO()
    Image.new("RGB", (300, 200), (10, 10, 10)).save(tiny, format="PNG")
    tiny_variants = image_upload.make_variants(tiny.getvalue(), sizes)
    assert set(tiny_variants) == set(sizes)
    for name, data in tiny_variants.items():
        variant_width = Image.open(io.BytesIO(data)).width
        assert variant_width == min(sizes[name], 300)
        assert variant_width <= 300, f"{name} was upscaled"


async def test_upload_timing_and_variant_files(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, sample_jpeg: bytes
) -> None:
    monkeypatch.setattr(image_upload, "STATIC_ROOT", tmp_path)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "AWS_ACCESS_KEY_ID", "")
    monkeypatch.setattr(settings, "AWS_SECRET_ACCESS_KEY", "")
    monkeypatch.setattr(settings, "AWS_S3_BUCKET", "")

    upload = UploadFile(filename="plant.jpg", file=io.BytesIO(sample_jpeg))
    started = time.perf_counter()
    key = await image_upload.upload_image_file(upload, "products", 9)
    elapsed_ms = (time.perf_counter() - started) * 1000

    written = sorted(p.relative_to(tmp_path).as_posix() for p in tmp_path.rglob("*.webp"))
    rows = [
        (p.name.split(".")[-2], p.stat().st_size)
        for p in sorted(tmp_path.rglob("*.webp"))
    ]
    _report(
        f"upload_image_file -> {key}",
        [("original", (tmp_path / key).stat().st_size), *rows],
        elapsed_ms,
    )

    assert (tmp_path / key).read_bytes() == sample_jpeg
    assert len(written) == 3  # thumb, card, detail


def test_http_fetch_timing_original_vs_variant(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, sample_jpeg: bytes
) -> None:
    """Time a real loopback HTTP fetch of the original vs the card variant."""
    monkeypatch.setattr(image_upload, "STATIC_ROOT", tmp_path)

    variants = image_upload.make_variants(sample_jpeg, image_upload.variants_for("products"))
    original = tmp_path / "plantoga/products/9/original.jpg"
    card = tmp_path / "plantoga/products/9/original.card.webp"
    for path, data in ((original, sample_jpeg), (card, variants["card"])):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    handler = partial(SimpleHTTPRequestHandler, directory=str(tmp_path))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        def fetch(url: str) -> tuple[int, float]:
            start = time.perf_counter()
            with urlopen(url) as resp:
                body = resp.read()
            return len(body), (time.perf_counter() - start) * 1000

        orig_bytes, orig_ms = fetch(f"{base}/plantoga/products/9/original.jpg")
        card_bytes, card_ms = fetch(f"{base}/plantoga/products/9/original.card.webp")
    finally:
        server.shutdown()
        server.server_close()

    _report(
        "loopback HTTP fetch",
        [
            ("original", orig_bytes),
            ("card", card_bytes),
        ],
    )
    print(f"  fetch original: {orig_ms:.2f} ms")
    print(f"  fetch card:     {card_ms:.2f} ms")
    print(f"  payload saved:  {100 * (1 - card_bytes / orig_bytes):.1f}%")

    assert card_bytes < orig_bytes
