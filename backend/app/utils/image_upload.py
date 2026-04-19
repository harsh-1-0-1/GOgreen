from fastapi import UploadFile
from loguru import logger

from app.utils.cloudinary_helper import CLOUDINARY_ENABLED, delete_image, upload_image
from app.utils.local_storage import save_local_image


async def handle_image_upload(file: UploadFile, folder: str) -> dict:
    """Upload to Cloudinary if configured, otherwise save locally."""
    if CLOUDINARY_ENABLED:
        contents = await file.read()
        result = upload_image(contents, folder=folder)
        logger.info("Image uploaded to Cloudinary: {}", result["public_id"])
        return result

    result = await save_local_image(file)
    logger.info("Image saved locally: {}", result["url"])
    return result


async def handle_image_delete(public_id: str | None) -> None:
    """Delete from Cloudinary if it was a Cloudinary image."""
    if public_id and CLOUDINARY_ENABLED:
        delete_image(public_id)
        logger.info("Cloudinary image deleted: {}", public_id)
