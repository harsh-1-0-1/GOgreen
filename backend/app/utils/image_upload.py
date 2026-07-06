import uuid
from pathlib import Path
import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from loguru import logger

from app.core.config import settings
from app.utils.cloudinary_helper import CLOUDINARY_ENABLED, upload_image, delete_image

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

S3_ENABLED = bool(
    settings.AWS_ACCESS_KEY_ID
    and settings.AWS_SECRET_ACCESS_KEY
    and settings.AWS_S3_BUCKET
)


def _get_s3_client():
    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION or "us-east-1",
    )


def resolve_image_url(key: str | None) -> str | None:
    if not key:
        return None
    if key.startswith(("http://", "https://", "/")):
        return key

    if settings.CDN_BASE_URL:
        return f"{settings.CDN_BASE_URL.rstrip('/')}/{key.lstrip('/')}"

    return f"{settings.BACKEND_PUBLIC_URL.rstrip('/')}/static/{key.lstrip('/')}"


def extract_relative_key(url: str | None) -> str | None:
    if not url:
        return None

    # Strip CDN base URL if present
    if settings.CDN_BASE_URL:
        cdn_prefix = settings.CDN_BASE_URL.rstrip('/') + '/'
        if url.startswith(cdn_prefix):
            return url[len(cdn_prefix):]

    # Strip backend public URL + /static/
    static_prefix = f"{settings.BACKEND_PUBLIC_URL.rstrip('/')}/static/"
    if url.startswith(static_prefix):
        return url[len(static_prefix):]

    # Strip local static prefix
    if url.startswith("/static/"):
        return url[len("/static/").lstrip("/"):]

    return url


def resolve_variants_images(variants: dict | None) -> dict | None:
    if not variants:
        return variants

    resolved = dict(variants)

    if "default_image" in resolved and resolved["default_image"]:
        resolved["default_image"] = resolve_image_url(resolved["default_image"])

    if "image_map" in resolved and isinstance(resolved["image_map"], dict):
        resolved["image_map"] = {
            k: resolve_image_url(v) for k, v in resolved["image_map"].items()
        }

    if "pot_types" in resolved and isinstance(resolved["pot_types"], list):
        resolved["pot_types"] = [
            {**pt, "image_url": resolve_image_url(pt.get("image_url"))} if "image_url" in pt else pt
            for pt in resolved["pot_types"]
        ]

    return resolved


def clean_variants_images(variants: dict | None) -> dict | None:
    if not variants:
        return variants

    cleaned = dict(variants)

    if "default_image" in cleaned and cleaned["default_image"]:
        cleaned["default_image"] = extract_relative_key(cleaned["default_image"])

    if "image_map" in cleaned and isinstance(cleaned["image_map"], dict):
        cleaned["image_map"] = {
            k: extract_relative_key(v) for k, v in cleaned["image_map"].items()
        }

    if "pot_types" in cleaned and isinstance(cleaned["pot_types"], list):
        cleaned["pot_types"] = [
            {**pt, "image_url": extract_relative_key(pt.get("image_url"))} if "image_url" in pt else pt
            for pt in cleaned["pot_types"]
        ]

    return cleaned


def generate_image_key(folder: str, entity_id: str | int | None, filename: str) -> str:
    ext = Path(filename).suffix.lower() if filename else ".jpg"
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".jpg"

    uuid_str = str(uuid.uuid4())
    clean_folder = folder.replace("plantoga/", "").strip("/")

    if clean_folder == "banners":
        return f"plantoga/banners/{uuid_str}{ext}"
    else:
        # products, categories, blog, product-variants
        eid = str(entity_id) if entity_id is not None else uuid_str
        return f"plantoga/{clean_folder}/{eid}/{uuid_str}{ext}"


def _upload_to_s3_sync(file_bytes: bytes, key: str, content_type: str) -> None:
    client = _get_s3_client()
    client.put_object(
        Bucket=settings.AWS_S3_BUCKET,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )


def _delete_from_s3_sync(key: str) -> None:
    client = _get_s3_client()
    client.delete_object(Bucket=settings.AWS_S3_BUCKET, Key=key)


async def upload_image_file(
    file: UploadFile,
    folder: str,
    entity_id: str | int | None = None,
) -> str:
    is_prod = settings.ENVIRONMENT.lower() == "production"
    if is_prod and not S3_ENABLED:
        raise RuntimeError("Missing AWS S3 credentials in production environment")

    contents = await file.read()
    key = generate_image_key(folder, entity_id, file.filename or "")

    if S3_ENABLED:
        content_type = file.content_type or "image/jpeg"
        await run_in_threadpool(_upload_to_s3_sync, contents, key, content_type)
        logger.info("Image uploaded to S3: {}", key)
        return key
    elif CLOUDINARY_ENABLED:
        result = upload_image(contents, folder=folder)
        logger.info("Image uploaded to Cloudinary: {}", result["url"])
        return result["url"]
    else:
        dest = Path("static") / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        await run_in_threadpool(dest.write_bytes, contents)
        logger.info("Image saved locally: {}", key)
        return key


async def delete_image_file(key: str | None) -> None:
    if not key:
        return

    if key.startswith("http"):
        if "cloudinary.com" in key and CLOUDINARY_ENABLED:
            pass
        return

    if S3_ENABLED:
        try:
            await run_in_threadpool(_delete_from_s3_sync, key)
            logger.info("Deleted S3 object: {}", key)
        except ClientError as e:
            logger.error("Failed to delete S3 object {}: {}", key, e)
    else:
        local_path = Path("static") / key
        if local_path.exists():
            try:
                await run_in_threadpool(local_path.unlink)
                logger.info("Deleted local file: {}", local_path)
            except Exception as e:
                logger.error("Failed to delete local file {}: {}", local_path, e)


async def handle_image_upload(file: UploadFile, folder: str) -> dict:
    """Fallback wrapper for backward compatibility."""
    key = await upload_image_file(file, folder)
    url = resolve_image_url(key)
    return {"url": url, "public_id": key}


async def handle_image_delete(public_id: str | None) -> None:
    """Fallback wrapper for backward compatibility."""
    if public_id:
        await delete_image_file(public_id)
