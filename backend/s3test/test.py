"""
Standalone S3 connectivity test for Plantoga.

Reads AWS credentials from .env (does NOT touch your app's ENVIRONMENT flag,
does NOT import your FastAPI app at all — fully isolated).

Usage:
    python test_s3_upload.py

Requires:
    pip install boto3 python-dotenv
"""

import os
import sys
import uuid
from pathlib import Path

import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from dotenv import load_dotenv

# ---- Load .env from current directory (adjust path if your .env lives elsewhere) ----
load_dotenv()

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET", "")
CDN_BASE_URL = os.getenv("CDN_BASE_URL", "")

TEST_PREFIX = "plantoga/_test"


def fail(msg: str):
    print(f"❌ {msg}")
    sys.exit(1)


def check_env():
    print("=== Checking .env values ===")
    missing = []
    if not AWS_ACCESS_KEY_ID:
        missing.append("AWS_ACCESS_KEY_ID")
    if not AWS_SECRET_ACCESS_KEY:
        missing.append("AWS_SECRET_ACCESS_KEY")
    if not AWS_S3_BUCKET:
        missing.append("AWS_S3_BUCKET")
    if missing:
        fail(f"Missing required env vars: {', '.join(missing)}")

    print(f"  AWS_REGION     = {AWS_REGION}")
    print(f"  AWS_S3_BUCKET  = {AWS_S3_BUCKET}")
    print(f"  CDN_BASE_URL   = {CDN_BASE_URL or '(not set)'}")
    print(f"  Access Key ID  = {AWS_ACCESS_KEY_ID[:4]}...{AWS_ACCESS_KEY_ID[-4:]}")
    print("  ✅ All required vars present\n")


def get_client():
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )


def make_test_image_bytes() -> bytes:
    """Reads a real image file from disk and returns its raw binary bytes."""
    # Resolve relative to THIS SCRIPT's folder, not the current working directory —
    # this way it works no matter where you run `uv run ... test.py` from.
    image_path = Path(__file__).parent / "test.png"

    try:
        with open(image_path, "rb") as image_file:
            return image_file.read()
    except FileNotFoundError:
        print(f"❌ Error: Could not find the file at {image_path.resolve()}")
        print("Please place a real image named 'test.png' next to this script.")
        sys.exit(1)


def run():
    check_env()
    s3 = get_client()

    # --- 1. Verify bucket is reachable and credentials work ---
    print("=== Step 1: Checking bucket access (head_bucket) ===")
    try:
        s3.head_bucket(Bucket=AWS_S3_BUCKET)
        print("  ✅ Bucket reachable and credentials valid\n")
    except NoCredentialsError:
        fail("No AWS credentials found — check .env values")
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "403":
            fail("403 Forbidden — IAM user lacks s3:ListBucket/HeadBucket permission, or bucket name is wrong")
        elif code == "404":
            fail(f"404 Not Found — bucket '{AWS_S3_BUCKET}' doesn't exist in region '{AWS_REGION}'")
        else:
            fail(f"head_bucket failed: {e}")

    # --- 2. Upload a test object ---
    test_key = f"{TEST_PREFIX}/{uuid.uuid4()}.png"
    print(f"=== Step 2: Uploading test object ===\n  Key: {test_key}")
    try:
        image_bytes = make_test_image_bytes()
        print(f"  [Debug] Data type: {type(image_bytes)}")
        print(f"  [Debug] Byte length: {len(image_bytes)} bytes")

        s3.put_object(
            Bucket=AWS_S3_BUCKET,
            Key=test_key,
            Body=image_bytes,
            ContentType="image/png",
        )
        print("  ✅ Upload succeeded (s3:PutObject works)\n")
    except ClientError as e:
        fail(f"Upload failed — check IAM has s3:PutObject on this bucket/prefix: {e}")

    # --- 3. Confirm the object exists (list) ---
    print("=== Step 3: Verifying object exists (list_objects_v2) ===")
    try:
        resp = s3.list_objects_v2(Bucket=AWS_S3_BUCKET, Prefix=TEST_PREFIX)
        keys = [obj["Key"] for obj in resp.get("Contents", [])]
        if test_key in keys:
            print(f"  ✅ Found {test_key} in bucket listing\n")
        else:
            fail("Uploaded key not found in listing — unexpected")
    except ClientError as e:
        fail(f"list_objects_v2 failed — check IAM has s3:ListBucket: {e}")

    # --- 4. Print the URLs you'd expect the app to serve ---
    print("=== Step 4: Resulting URLs ===")
    if CDN_BASE_URL:
        cdn_url = f"{CDN_BASE_URL.rstrip('/')}/{test_key}"
        print(f"  CloudFront URL: {cdn_url}")
        print("  \033[94m→ Open this in your browser now.\033[0m")
    else:
        print("  CDN_BASE_URL not set — skipping CloudFront URL check")
    direct_s3_url = f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{test_key}"
    print(f"  Direct S3 URL (should 403, this is expected/correct): {direct_s3_url}\n")

    # --- Pause so the object isn't deleted before you can test the CDN URL in a browser ---
    input("👉 KEEP THIS TERMINAL OPEN. Check the CloudFront URL. Press Enter ONLY when done viewing it...\n")

    # --- 5. Clean up ---
    print("=== Step 5: Deleting test object (s3:DeleteObject) ===")
    try:
        s3.delete_object(Bucket=AWS_S3_BUCKET, Key=test_key)
        print("  ✅ Test object deleted, bucket left clean\n")
    except ClientError as e:
        print(f"  ⚠️  Delete failed (upload/list worked fine though): {e}")
        print(f"  You may need to manually delete: {test_key}")

    print("=== ✅ ALL CHECKS PASSED ===")


if __name__ == "__main__":
    run()