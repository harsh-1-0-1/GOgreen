import uuid
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from loguru import logger

from app.core.config import settings

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".mp4", ".webm"}
STATIC_ROOT = Path("static")


class ImageStorageUnavailableError(RuntimeError):
    """Raised when the configured image storage cannot safely accept uploads."""


def _s3_enabled() -> bool:
    return bool(
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

    is_prod = settings.ENVIRONMENT.lower() == "production"
    if is_prod and settings.CDN_BASE_URL:
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
        return url[len("/static/"):]

    return url


def resolve_variants_images(variants: dict | None) -> dict | None:
    """Resolve relative image keys to full URLs in variant structure.
    
    Supports both old format (colors, pot_types, image_map) and 
    new format (variant_groups with per-option images).
    """
    if not variants:
        return variants

    resolved = dict(variants)

    # Always resolve default_image if present
    if "default_image" in resolved and resolved["default_image"]:
        resolved["default_image"] = resolve_image_url(resolved["default_image"])

    # New format: variant_groups
    if "variant_groups" in resolved and isinstance(resolved["variant_groups"], list):
        resolved_groups = []
        for group in resolved["variant_groups"]:
            resolved_group = dict(group)
            if "options" in resolved_group and isinstance(resolved_group["options"], list):
                resolved_options = []
                for option in resolved_group["options"]:
                    resolved_option = dict(option)
                    # Resolve images array for each option
                    if "images" in resolved_option and isinstance(resolved_option["images"], list):
                        resolved_option["images"] = [
                            resolve_image_url(img) for img in resolved_option["images"]
                        ]
                    resolved_options.append(resolved_option)
                resolved_group["options"] = resolved_options
            resolved_groups.append(resolved_group)
        resolved["variant_groups"] = resolved_groups

    # Old format: image_map, pot_types, colors
    if "image_map" in resolved and isinstance(resolved["image_map"], dict):
        resolved["image_map"] = {
            k: [resolve_image_url(img) for img in v] if isinstance(v, list) else []
            for k, v in resolved["image_map"].items()
        }

    if "pot_types" in resolved and isinstance(resolved["pot_types"], list):
        resolved["pot_types"] = [
            {**pt, "image_url": resolve_image_url(pt.get("image_url"))} if "image_url" in pt else pt
            for pt in resolved["pot_types"]
        ]

    if "colors" in resolved and isinstance(resolved["colors"], list):
        resolved["colors"] = [
            {**c, "image_url": resolve_image_url(c.get("image_url"))} if "image_url" in c else c
            for c in resolved["colors"]
        ]

    return resolved


def generate_image_key(folder: str, entity_id: str | int | None, filename: str) -> str:
    ext = Path(filename).suffix.lower() if filename else ".jpg"
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".jpg"

    uuid_str = str(uuid.uuid4())
    clean_folder = folder.removeprefix("plantoga/").strip("/")
    if not clean_folder or any(part in {"", ".", ".."} for part in clean_folder.split("/")):
        raise ValueError("Invalid image folder")

    eid = str(entity_id) if entity_id is not None else uuid_str
    if "/" in eid or "\\" in eid or eid in {".", ".."}:
        raise ValueError("Invalid image entity id")
    return f"plantoga/{clean_folder}/{eid}/{uuid_str}{ext}"


def _upload_to_s3_sync(file_bytes: bytes, key: str, content_type: str) -> None:
    client = _get_s3_client()
    client.put_object(
        Bucket=settings.AWS_S3_BUCKET,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
        CacheControl="public, max-age=31536000, immutable",  # Cache for 1 year
        Metadata={
            "uploaded-by": "plantoga-backend",
        },
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
    s3_enabled = _s3_enabled()
    if is_prod and not s3_enabled:
        raise ImageStorageUnavailableError(
            "Missing AWS S3 credentials in production environment"
        )

    contents = await file.read()
    key = generate_image_key(folder, entity_id, file.filename or "")

    # Only use S3 in production. Local / dev / staging always writes to static/.
    if is_prod and s3_enabled:
        content_type = file.content_type or "image/jpeg"
        await run_in_threadpool(_upload_to_s3_sync, contents, key, content_type)
        logger.info("Image uploaded to S3: {}", key)
        return key
    dest = STATIC_ROOT / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    await run_in_threadpool(dest.write_bytes, contents)
    logger.info("Image saved locally: {}", key)
    return key


async def delete_image_file(key: str | None) -> None:
    if not key:
        return

    relative_key = extract_relative_key(key)
    if not relative_key or relative_key.startswith(("http://", "https://", "/")):
        return

    if settings.ENVIRONMENT.lower() == "production" and _s3_enabled():
        try:
            await run_in_threadpool(_delete_from_s3_sync, relative_key)
            logger.info("Deleted S3 object: {}", relative_key)
        except ClientError as e:
            logger.error("Failed to delete S3 object {}: {}", key, e)
    else:
        local_path = (STATIC_ROOT / relative_key).resolve()
        static_root = STATIC_ROOT.resolve()
        if static_root not in local_path.parents:
            logger.warning("Refusing to delete image outside static root: {}", relative_key)
            return
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
