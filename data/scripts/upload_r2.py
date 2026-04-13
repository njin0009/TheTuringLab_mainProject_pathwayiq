"""
upload_r2.py
Uploads all processed JSON files to Cloudflare R2.

R2 uses an S3-compatible API — only the endpoint URL differs from S3.
To switch back to S3: change ENDPOINT_URL to None and use a standard bucket.

Usage:
  R2_ACCOUNT_ID=xxx R2_ACCESS_KEY=xxx R2_SECRET_KEY=xxx \
  R2_BUCKET=pathwayiq-data python upload_r2.py

Required env vars:
  R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET
"""
import os
import boto3
from pathlib import Path

PROCESSED = Path(__file__).parent.parent / "processed"

FILES_TO_UPLOAD = [
    "careers.json",
    "shortage_labels.json",
    "ai_risk_scores.json",
    "education_pathways.json",
]

def get_client():
    account_id = os.environ["R2_ACCOUNT_ID"]
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY"],
        aws_secret_access_key=os.environ["R2_SECRET_KEY"],
        region_name="auto",
    )

def upload():
    client = get_client()
    bucket = os.environ["R2_BUCKET"]

    for filename in FILES_TO_UPLOAD:
        path = PROCESSED / filename
        if not path.exists():
            print(f"⚠  {filename} not found — run merge_careers.py first")
            continue
        client.upload_file(
            str(path),
            bucket,
            filename,
            ExtraArgs={"ContentType": "application/json"},
        )
        size = path.stat().st_size / 1024
        print(f"✓  {filename} uploaded ({size:.1f} KB)")

if __name__ == "__main__":
    upload()
