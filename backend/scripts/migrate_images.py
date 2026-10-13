"""Backfill WebP image variants and immutable Cache-Control for existing S3 objects.

Idempotent: already-generated variants are skipped, and the original's
Cache-Control is only touched when it differs from the desired value. Originals
are never deleted or renamed, so running this is safe and reversible.

Usage (from the `backend/` directory, with prod S3 credentials in the env):

    uv run python scripts/migrate_images.py --dry-run
    uv run python scripts/migrate_images.py --limit 5
    uv run python scripts/migrate_images.py --prefix plantoga/products/
    uv run python scripts/migrate_images.py
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import boto3

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


def _folder_of(key: str) -> str:
    parts = key.split("/", 2)
    return parts[1] if len(parts) > 1 else ""


def _is_candidate(key: str) -> bool:
    if key.endswith(VARIANT_SUFFIXES):
        return False
    return Path(key).suffix.lower() in IMAGE_EXTENSIONS


def _process(s3, bucket, key, existing, dry_run, stats) -> bool:
    """Handle one original. Returns True when it needed/would change something.

    `existing` is the full key listing for the prefix, so variant presence is a
    set lookup instead of a HEAD per variant.
    """
    sizes = variants_for(_folder_of(key))
    if not sizes:
        return False

    changed = False

    # --- variants -------------------------------------------------------------
    missing = [n for n in sizes if variant_key(key, n) not in existing]
    if missing:
        changed = True
        stats["need_variants"] += 1
        if dry_run:
            planned = ", ".join(variant_key(key, n) for n in missing)
            print(f"[dry-run] variants  {key} -> {planned}")
        else:
            try:
                body = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
                variants = make_variants(body, sizes)
            except Exception as exc:  # noqa: BLE001 - report and continue
                stats["failed"] += 1
                print(f"[error]   {key}: variant generation failed: {exc}")
            else:
                created = 0
                for name in missing:
                    if name not in variants:
                        stats["failed"] += 1
                        print(f"[warn]    {key}: {name} was not generated")
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
                stats["created"] += created
                print(f"[variants] {key} -> {created} created")
    else:
        stats["skipped"] += 1

    # --- original Cache-Control backfill --------------------------------------
    head = s3.head_object(Bucket=bucket, Key=key)
    if head.get("CacheControl") != IMMUTABLE_CACHE_CONTROL:
        changed = True
        stats["need_header"] += 1
        if dry_run:
            print(f"[dry-run] cache-hdr {key}")
        else:
            # MetadataDirective=REPLACE drops every header not passed back, so
            # carry over the ones uploads can set alongside ContentType.
            extra = {
                k: head[k]
                for k in ("ContentDisposition", "ContentEncoding", "ContentLanguage")
                if k in head
            }
            s3.copy_object(
                Bucket=bucket,
                Key=key,
                CopySource={"Bucket": bucket, "Key": key},
                MetadataDirective="REPLACE",
                ContentType=head.get("ContentType", "application/octet-stream"),
                CacheControl=IMMUTABLE_CACHE_CONTROL,
                Metadata=head.get("Metadata", {}),
                **extra,
            )
            stats["fixed_header"] += 1
            print(f"[cache-hdr] {key}")

    return changed


def _summary(stats: dict, dry_run: bool) -> None:
    print(
        f"\nScanned {stats['scanned']} objects; created {stats['created']} variants; "
        f"updated {stats['fixed_header']} originals; {stats['skipped']} already complete; "
        f"{stats['failed']} failed."
    )
    if dry_run:
        print(
            f"[dry-run] {stats['need_variants']} objects need variants; "
            f"{stats['need_header']} need the Cache-Control header."
        )
        print("(dry run — nothing written)")
    if stats["failed"]:
        print(f"WARNING: {stats['failed']} object(s) failed; re-run to retry.")


def migrate(dry_run: bool, prefixes: tuple[str, ...], limit: int | None) -> int:
    s3 = _s3()
    bucket = settings.AWS_S3_BUCKET
    stats = {
        "scanned": 0,
        "created": 0,
        "fixed_header": 0,
        "skipped": 0,
        "failed": 0,
        "need_variants": 0,
        "need_header": 0,
    }
    work = 0

    for prefix in prefixes:
        paginator = s3.get_paginator("list_objects_v2")
        keys = [
            obj["Key"]
            for page in paginator.paginate(Bucket=bucket, Prefix=prefix)
            for obj in page.get("Contents", [])
        ]
        existing = set(keys)

        for key in keys:
            if not _is_candidate(key):
                continue
            stats["scanned"] += 1
            try:
                did_work = _process(s3, bucket, key, existing, dry_run, stats)
            except Exception as exc:  # noqa: BLE001 - keep going; reruns are safe
                stats["failed"] += 1
                print(f"[error]   {key}: {exc}")
                continue
            if did_work:
                work += 1
                if limit is not None and work >= limit:
                    print(f"\nReached --limit {limit} ({work} objects needed work); stopping.")
                    _summary(stats, dry_run)
                    return stats["failed"]

    _summary(stats, dry_run)
    return stats["failed"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="show work without writing")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="stop after N objects that need work (canary runs)",
    )
    parser.add_argument(
        "--prefix",
        action="append",
        dest="prefixes",
        help="limit to an S3 prefix (repeatable). Defaults to all image folders.",
    )
    args = parser.parse_args()
    failed = migrate(
        args.dry_run,
        tuple(args.prefixes) if args.prefixes else DEFAULT_PREFIXES,
        args.limit,
    )
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
