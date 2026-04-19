import uuid
from pathlib import Path

from fastapi import UploadFile

UPLOAD_DIR = Path("static/banners")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


async def save_local_image(file: UploadFile) -> dict:
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    dest = UPLOAD_DIR / filename
    contents = await file.read()
    dest.write_bytes(contents)
    return {
        "url": f"/static/banners/{filename}",
        "public_id": None,
    }
