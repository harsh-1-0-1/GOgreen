import uuid
from io import BytesIO
from pathlib import Path, PurePosixPath

import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from loguru import logger
from PIL import Image, ImageOps

from app.core.config import settings

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".mp4", ".webm"}
STATIC_ROOT = Path("static")

# WebP variants generated per folder. Keys become `<stem>.<variant>.webp`
# siblings of the original, so multiple images inside one entity folder never
# collide. Folders not listed get no variants.
FOLDER_VARIANTS: dict[str, dict[str, int]] = {
    "products": {"thumb": 400, "card": 800, "detail": 1600},
    "product-variants": {"thumb": 400, "card": 800, "detail": 1600},
    "categories": {"thumb": 400, "card": 800},
    "blog": {"card": 800, "detail": 1600},
    "stories": {"thumb": 400, "card": 800},
    "banners": {"w400": 400, "w800": 800, "w1600": 1600, "w1920": 1920},
}
VARIANT_QUALITY = 80
IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"


def variants_for(folder: str) -> dict[str, int]:
    """Variant name → target width for a storage folder ('' when none)."""
    clean = folder.removeprefix("plantoga/").strip("/").split("/", 1)[0]
    return FOLDER_VARIANTS.get(clean, {})


def variant_key(original_key: str, variant: str) -> str:
    """`plantoga/products/42/abc.png` → `plantoga/products/42/abc.card.webp`."""
    path = PurePosixPath(original_key)
    return str(path.with_name(f"{path.stem}.{variant}.webp"))


def make_variants(
    file_bytes: bytes,
    sizes: dict[str, int],
    quality: int = VARIANT_QUALITY,
) -> dict[str, bytes]:
    """Return {variant_name: webp_bytes} for one source image.

    Each target width is clamped to the source width so *every* advertised
    variant is emitted (a narrow source is never upscaled, but still gets a
    file). Keeps the aspect ratio, applies the EXIF orientation first, and
    preserves alpha as RGBA WebP so cutout product photos don't get a white box.
    """
    out: dict[str, bytes] = {}
    with Image.open(BytesIO(file_bytes)) as opened:
        source = ImageOps.exif_transpose(opened)
        source.load()
        width, height = source.size
        has_alpha = source.mode in ("RGBA", "LA") or (
            source.mode == "P" and "transparency" in source.info
        )
        for name, target_w in sizes.items():
            out_w = min(target_w, width)
            ratio = out_w / width
            resized = source.resize(
                (out_w, max(1, round(height * ratio))), Image.LANCZOS
            )
            resized = resized.convert("RGBA" if has_alpha else "RGB")
            buffer = BytesIO()
            resized.save(buffer, format="WEBP", quality=quality, method=4)
            out[name] = buffer.getvalue()
    return out


def build_variants(file_bytes: bytes, folder: str) -> dict[str, bytes]:
    """make_variants() for a folder, swallowing unsupported-format errors."""
    sizes = variants_for(folder)
    if not sizes:
        return {}
    try:
        return make_variants(file_bytes, sizes)
    except Exception as exc:  # unsupported codec, video, etc. — never block upload
        logger.warning("Variant generation skipped for folder {}: {}", folder, exc)
        return {}


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


def _public_url(key: str) -> str:
    is_prod = settings.ENVIRONMENT.lower() == "production"
    if is_prod and settings.CDN_BASE_URL:
        return f"{settings.CDN_BASE_URL.rstrip('/')}/{key.lstrip('/')}"
    return f"{settings.BACKEND_PUBLIC_URL.rstrip('/')}/static/{key.lstrip('/')}"


def resolve_image_url(key: str | None, variant: str | None = None) -> str | None:
    """Resolve a stored relative key to a full URL.

    Pass `variant` ("thumb" / "card" / "detail" / "w1600" / "w1920") to point at
    the generated WebP sibling. External URLs and folders without that variant
    fall back to the original key unchanged.
    """
    if not key:
        return None
    # Some rows store the full CDN URL instead of the key; strip it so variants still resolve.
    if settings.CDN_BASE_URL:
        cdn_prefix = settings.CDN_BASE_URL.rstrip("/") + "/"
        if key.startswith(cdn_prefix):
            key = key[len(cdn_prefix):]
    if key.startswith(("http://", "https://", "/")):
        return key

    if variant and variant in variants_for(key):
        return _public_url(variant_key(key, variant))
    return _public_url(key)


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


PRODUCT_VARIANT_NAMES = ("thumb", "card", "detail")


def image_variant_set(key: str) -> dict[str, str]:
    """{original, thumb, card, detail} URLs for one stored product image key."""
    return {
        "original": resolve_image_url(key),
        **{name: resolve_image_url(key, name) for name in PRODUCT_VARIANT_NAMES},
    }


def collect_variant_image_keys(variants: dict | None) -> list[str]:
    """Every raw image key referenced inside a product's `variants` JSON.

    Covers both formats (variant_groups options, image_map, pot_types, colors,
    default_image), de-duplicated in first-seen order.
    """
    if not variants:
        return []
    keys: list[str] = []

    def add(val) -> None:
        if isinstance(val, str) and val and val not in keys:
            keys.append(val)

    add(variants.get("default_image"))
    for group in variants.get("variant_groups") or []:
        for option in (group or {}).get("options") or []:
            for img in (option or {}).get("images") or []:
                add(img)
    image_map = variants.get("image_map")
    if isinstance(image_map, dict):
        for imgs in image_map.values():
            for img in imgs if isinstance(imgs, list) else []:
                add(img)
    for item in (variants.get("pot_types") or []) + (variants.get("colors") or []):
        if isinstance(item, dict):
            add(item.get("image_url"))
    return keys


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
        CacheControl=IMMUTABLE_CACHE_CONTROL,  # Cache for 1 year
        Metadata={
            "uploaded-by": "plantoga-backend",
        },
    )


def _upload_variant_to_s3_sync(key: str, body: bytes) -> None:
    client = _get_s3_client()
    client.put_object(
        Bucket=settings.AWS_S3_BUCKET,
        Key=key,
        Body=body,
        ContentType="image/webp",
        CacheControl=IMMUTABLE_CACHE_CONTROL,
        Metadata={"uploaded-by": "plantoga-backend", "variant": "webp"},
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
    # Pillow resize/encode is CPU-bound (~0.5 s for a large photo) — keep it off
    # the event loop, alongside the blocking S3 writes below.
    variants = await run_in_threadpool(build_variants, contents, folder)

    # Only use S3 in production. Local / dev / staging always writes to static/.
    if is_prod and s3_enabled:
        content_type = file.content_type or "image/jpeg"
        await run_in_threadpool(_upload_to_s3_sync, contents, key, content_type)
        for name, data in variants.items():
            # A single variant failure must not fail the request: the original
            # is already stored and the client falls back via onError.
            try:
                await run_in_threadpool(
                    _upload_variant_to_s3_sync, variant_key(key, name), data
                )
            except Exception as exc:
                logger.warning(
                    "Variant upload failed for {}.{}: {}", key, name, exc
                )
        logger.info("Image uploaded to S3: {} (+{} variants)", key, len(variants))
        return key

    dest = STATIC_ROOT / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    await run_in_threadpool(dest.write_bytes, contents)
    for name, data in variants.items():
        try:
            variant_dest = STATIC_ROOT / variant_key(key, name)
            variant_dest.parent.mkdir(parents=True, exist_ok=True)
            await run_in_threadpool(variant_dest.write_bytes, data)
        except Exception as exc:
            logger.warning("Variant write failed for {}.{}: {}", key, name, exc)
    logger.info("Image saved locally: {} (+{} variants)", key, len(variants))
    return key


async def delete_image_file(key: str | None) -> None:
    if not key:
        return

    relative_key = extract_relative_key(key)
    if not relative_key or relative_key.startswith(("http://", "https://", "/")):
        return

    # Also remove the generated WebP siblings so deletes don't leave orphans.
    all_keys = [relative_key]
    all_keys.extend(variant_key(relative_key, name) for name in variants_for(relative_key))

    if settings.ENVIRONMENT.lower() == "production" and _s3_enabled():
        for obj_key in all_keys:
            try:
                await run_in_threadpool(_delete_from_s3_sync, obj_key)
                logger.info("Deleted S3 object: {}", obj_key)
            except ClientError as e:
                logger.error("Failed to delete S3 object {}: {}", obj_key, e)
        return

    static_root = STATIC_ROOT.resolve()
    for obj_key in all_keys:
        local_path = (STATIC_ROOT / obj_key).resolve()
        if static_root not in local_path.parents:
            logger.warning("Refusing to delete image outside static root: {}", obj_key)
            continue
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
