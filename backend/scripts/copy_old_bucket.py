"""Copy every image under `plantoga/` from the old AWS account's bucket to the new one.

Runs inside the backend container. Reads these env vars:

    OLD_AWS_ACCESS_KEY_ID, OLD_AWS_SECRET_ACCESS_KEY, OLD_AWS_REGION, OLD_AWS_S3_BUCKET
    NEW_AWS_ACCESS_KEY_ID, NEW_AWS_SECRET_ACCESS_KEY, NEW_AWS_REGION, NEW_AWS_S3_BUCKET

Objects already in the new bucket are skipped, so it is safe to run again.
Content-Type is kept and Cache-Control is set to the 1-year value uploads use.

Usage (from the backend folder in the container):

    python scripts/copy_old_bucket.py --dry-run
    python scripts/copy_old_bucket.py
"""

from __future__ import annotations

import argparse
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

import boto3

PREFIX = "plantoga/"
CACHE_CONTROL = "public, max-age=31536000, immutable"


def _client(side: str):
    names = [f"{side}_AWS_{n}" for n in ("ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "REGION", "S3_BUCKET")]
    missing = [n for n in names if not os.environ.get(n)]
    if missing:
        raise SystemExit(f"Missing env vars: {', '.join(missing)}")
    client = boto3.client(
        "s3",
        aws_access_key_id=os.environ[names[0]],
        aws_secret_access_key=os.environ[names[1]],
        region_name=os.environ[names[2]],
    )
    return client, os.environ[names[3]]


def _keys(client, bucket: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for page in client.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=PREFIX):
        for obj in page.get("Contents", []):
            out[obj["Key"]] = obj["Size"]
    return out


def _copy(old, old_bucket, new, new_bucket, key) -> None:
    resp = old.get_object(Bucket=old_bucket, Key=key)
    new.put_object(
        Bucket=new_bucket,
        Key=key,
        Body=resp["Body"].read(),
        ContentType=resp.get("ContentType", "application/octet-stream"),
        CacheControl=CACHE_CONTROL,
        Metadata=resp.get("Metadata", {}),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="count only, copy nothing")
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()

    old, old_bucket = _client("OLD")
    new, new_bucket = _client("NEW")

    old_keys = _keys(old, old_bucket)
    new_keys = _keys(new, new_bucket)
    todo = [k for k in old_keys if k not in new_keys]
    size_mb = sum(old_keys[k] for k in todo) / 1024 / 1024

    print(f"Old bucket {old_bucket}: {len(old_keys)} objects")
    print(f"New bucket {new_bucket}: {len(new_keys)} objects")
    print(f"To copy: {len(todo)} objects, {size_mb:.1f} MB")
    if args.dry_run or not todo:
        return

    failed = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(_copy, old, old_bucket, new, new_bucket, k): k for k in todo}
        for i, fut in enumerate(as_completed(futures), 1):
            try:
                fut.result()
            except Exception as exc:  # noqa: BLE001 - report and keep going
                failed += 1
                print(f"[error] {futures[fut]}: {exc}")
            if i % 100 == 0:
                print(f"  {i}/{len(todo)} done")

    print(f"Copied {len(todo) - failed}, failed {failed}. New bucket now has "
          f"{len(_keys(new, new_bucket))} objects.")
    if failed:
        print("Run it again to retry the failed ones.")
        sys.exit(1)


if __name__ == "__main__":
    main()
