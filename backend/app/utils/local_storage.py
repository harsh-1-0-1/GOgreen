import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings

UPLOAD_ROOT = Path("static")
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


async def save_local_image(file: UploadFile, folder: str = "banners") -> dict:
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    local_folder = Path(folder).name or "uploads"
    upload_dir = UPLOAD_ROOT / local_folder
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest = upload_dir / filename
    contents = await file.read()
    dest.write_bytes(contents)
    return {
        "url": f"{settings.BACKEND_PUBLIC_URL.rstrip('/')}/static/{local_folder}/{filename}",
        "public_id": None,
    }
