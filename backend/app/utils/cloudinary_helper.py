import cloudinary
import cloudinary.uploader
from loguru import logger

from app.core.config import settings

_configured = False


def _ensure_configured() -> None:
    global _configured
    if _configured:
        return
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )
    _configured = True


def upload_image(file_bytes: bytes, folder: str = "gogreen") -> dict:
    _ensure_configured()
    result = cloudinary.uploader.upload(file_bytes, folder=folder)
    logger.info("Cloudinary upload: public_id={}", result["public_id"])
    return {"url": result["secure_url"], "public_id": result["public_id"]}


def delete_image(public_id: str) -> None:
    _ensure_configured()
    cloudinary.uploader.destroy(public_id)
    logger.info("Cloudinary delete: public_id={}", public_id)
