# Cloudflare R2 — Bucket Structure

Bucket name: `pathwayiq-data`  
Region: auto (Cloudflare global)  
Access: private (Lambda reads via API key, no public access)

---

## Object layout

```
pathwayiq-data/
├── careers.json              ← master career dictionary (~500 careers)
├── ai_risk_scores.json       ← ANZSCO → risk score 0–1
├── shortage_labels.json      ← ANZSCO → shortage/disappearing flags
└── education_pathways.json   ← ANZSCO → Uni/TAFE/Apprenticeship pathways
```

## Setup steps (one-time)

1. Cloudflare Dashboard → R2 → Create bucket → name: `pathwayiq-data`
2. R2 → Manage R2 API tokens → Create token with `Object Read & Write` on this bucket
3. Copy Account ID, Access Key ID, Secret Access Key → add to GitHub secrets
4. Run `python data/scripts/upload_r2.py` to populate the bucket

## Why R2 over S3?

- Zero egress fees (S3 charges $0.09/GB out)
- 10 GB permanent free storage
- S3-compatible API — `upload_r2.py` uses `boto3`, same as S3
- Lambda reads via `@aws-sdk/client-s3` with custom endpoint URL
