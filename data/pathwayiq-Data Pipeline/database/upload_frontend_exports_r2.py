"""
Upload frontend CSV exports to Cloudflare R2.

Usage:
  R2_ACCOUNT_ID=xxx R2_ACCESS_KEY=xxx R2_SECRET_KEY=xxx R2_BUCKET=pathwayiq-data \
  python upload_frontend_exports_r2.py

Optional:
  R2_PREFIX=frontend/v1
"""

from __future__ import annotations

import os
from pathlib import Path

import boto3


ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT.parent / "frontend_exports"
FILES_TO_UPLOAD = ["occupations.csv", "programs.csv", "pathways.csv"]


def get_client():
    account_id = os.environ["R2_ACCOUNT_ID"]
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY"],
        aws_secret_access_key=os.environ["R2_SECRET_KEY"],
        region_name="auto",
    )


def main() -> None:
    client = get_client()
    bucket = os.environ["R2_BUCKET"]
    prefix = os.environ.get("R2_PREFIX", "frontend")

    for filename in FILES_TO_UPLOAD:
        path = FRONTEND_DIR / filename
        if not path.exists():
            print(f"Skipping missing file: {path}")
            continue
        key = f"{prefix.rstrip('/')}/{filename}"
        client.upload_file(
            str(path),
            bucket,
            key,
            ExtraArgs={
                "ContentType": "text/csv; charset=utf-8",
                "CacheControl": "public, max-age=3600",
            },
        )
        print(f"Uploaded {filename} -> r2://{bucket}/{key}")


if __name__ == "__main__":
    main()
