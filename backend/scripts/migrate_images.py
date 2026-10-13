"""Backfill WebP image variants and immutable Cache-Control for existing S3 objects.

Idempotent: already-generated variants are skipped, and the original's
Cache-Control is only touched when it differs from the desired value. Originals
are never deleted or renamed, so running this is safe and reversible.

Usage (from the `backend/` directory, with prod S3 credentials in the env):

    uv run python scripts/migrate_images.py --dry-run
    uv run python scripts/migrate_images.py --prefix plantoga/products/
    uv run python scripts/migrate_images.py
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

# Allow `python scripts/migrate_images.py` from the backend root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.utils.image_upload import (  # noqa: E402
    IMMUTABLE_CACHE_CONTROL,
    make_variants,
    variant_key,
    variants_for,
)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
VARIANT_SUFFIXES = tuple(f".{name}.webp" for name in ("thumb", "card", "detail", "w1600", "w1920"))
DEFAULT_PREFIXES = tuple(f"plantoga/{folder}/" for folder in (
    "products", "product-variants", "categories", "blog", "stories", "banners",
))


def _s3():
    if not (settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY and settings.AWS_S3_BUCKET):
        raise SystemExit("AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_S3_BUCKET must be set")
    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION or "us-east-1",
    )


def _exists(s3, bucket: str, key: str) -> bool:
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
            return False
        raise


def _folder_of(key: str) -> str:
    parts = key.split("/", 2)
    return parts[1] if len(parts) > 1 else ""


def _is_candidate(key: str) -> bool:
    if key.endswith(VARIANT_SUFFIXES):
        return False
    return Path(key).suffix.lower() in IMAGE_EXTENSIONS


def migrate(dry_run: bool, prefixes: tuple[str, ...]) -> None:
    s3 = _s3()
    bucket = settings.AWS_S3_BUCKET
    created = fixed_header = scanned = skipped = 0

    for prefix in prefixes:
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if not _is_candidate(key):
                    continue
                scanned += 1
                sizes = variants_for(_folder_of(key))
                if not sizes:
                    continue

                # --- variants -------------------------------------------------
                missing = [n for n in sizes if not _exists(s3, bucket, variant_key(key, n))]
                if missing:
                    # Validate generated names before we spell out the plan.
                    planned = ", ".join(variant_key(key, n) for n in missing)
                    if dry_run:
                        print(f"[dry-run] variants  {key} -> {planned}")
                    else:
                        try:
                            body = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
                            variants = make_variants(body, sizes)
                        except Exception as exc:  # noqa: BLE001 - report and continue
                            print(f"[skip]    {key}: variant generation failed: {exc}")
                            continue
                        for name in missing:
                            if name not in variants:
                                continue  # defensive: unsupported/corrupt source
                            s3.put_object(
                                Bucket=bucket,
                                Key=variant_key(key, name),
                                Body=variants[name],
                                ContentType="image/webp",
                                CacheControl=IMMUTABLE_CACHE_CONTROL,
                                Metadata={"uploaded-by": "migrate_images", "variant": "webp"},
                            )
                            created += 1
                        print(f"[variants] {key} -> {len([n for n in missing if n in variants])} created")
                else:
                    skipped += 1

                # --- original Cache-Control backfill --------------------------
                head = s3.head_object(Bucket=bucket, Key=key)
                if head.get("CacheControl") != IMMUTABLE_CACHE_CONTROL:
                    if dry_run:
                        print(f"[dry-run] cache-hdr {key}")
                    else:
                        s3.copy_object(
                            Bucket=bucket,
                            Key=key,
                            CopySource={"Bucket": bucket, "Key": key},
                            MetadataDirective="REPLACE",
                            ContentType=head.get("ContentType", "application/octet-stream"),
                            CacheControl=IMMUTABLE_CACHE_CONTROL,
                            Metadata=head.get("Metadata", {}),
                        )
                        fixed_header += 1
                        print(f"[cache-hdr] {key}")

    print(
        f"\nScanned {scanned} objects; created {created} variants; "
        f"updated {fixed_header} originals; {skipped} already complete."
        + (" (dry run — nothing written)" if dry_run else "")
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="show work without writing")
    parser.add_argument(
        "--prefix",
        action="append",
        dest="prefixes",
        help="limit to an S3 prefix (repeatable). Defaults to all image folders.",
    )
    args = parser.parse_args()
    migrate(args.dry_run, tuple(args.prefixes) if args.prefixes else DEFAULT_PREFIXES)


if __name__ == "__main__":
    main()
