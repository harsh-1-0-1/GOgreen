import cloudinary
import cloudinary.uploader
from loguru import logger

from app.core.config import settings

CLOUDINARY_ENABLED = False


def _ensure_configured() -> bool:
    global CLOUDINARY_ENABLED
    if (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_CLOUD_NAME not in ("", "your_cloud_name")
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        CLOUDINARY_ENABLED = True
    return CLOUDINARY_ENABLED


_ensure_configured()


def upload_image(file_bytes: bytes, folder: str = "plantoga") -> dict:
    if not CLOUDINARY_ENABLED:
        raise RuntimeError("Cloudinary is not configured")
    result = cloudinary.uploader.upload(file_bytes, folder=folder)
    logger.info("Cloudinary upload: public_id={}", result["public_id"])
    return {"url": result["secure_url"], "public_id": result["public_id"]}


def delete_image(public_id: str) -> None:
    if not CLOUDINARY_ENABLED:
        logger.warning("Cloudinary not configured, skipping delete for {}", public_id)
        return
    cloudinary.uploader.destroy(public_id)
    logger.info("Cloudinary delete: public_id={}", public_id)
