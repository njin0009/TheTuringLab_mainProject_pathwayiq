# Environment Variables

All secrets are stored in GitHub Actions secrets and injected at deploy time. **Never commit `.env` files.**

---

## Frontend — Cloudflare Pages

Set in: Cloudflare Dashboard → Pages → pathwayiq → Settings → Environment Variables

| Variable | Example | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://abc123.execute-api.ap-southeast-2.amazonaws.com/prod` | AWS API Gateway base URL |

For local development, create `apps/web/.env.local`:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

---

## Backend — AWS Lambda (via Serverless Framework)

Set in: GitHub Actions secrets → used in `backend-deploy.yml`

| Variable | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS IAM user key for deployment |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM user secret |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY` | R2 API token access key |
| `R2_SECRET_KEY` | R2 API token secret key |
| `R2_BUCKET_NAME` | R2 bucket name, e.g. `pathwayiq-data` |
| `FEATURE_AI_MATCHING` | `false` (Iter 1–2) → `true` (Iter 3) |

---

## Data Pipeline — local only

For running `upload_r2.py` locally:

```bash
export R2_ACCOUNT_ID=your_account_id
export R2_ACCESS_KEY=your_access_key
export R2_SECRET_KEY=your_secret_key
export R2_BUCKET=pathwayiq-data

cd data
python scripts/upload_r2.py
```

---

## IAM Permissions required for deployment user

The AWS IAM user used in GitHub Actions needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["lambda:*", "apigateway:*", "iam:PassRole",
      "cloudformation:*", "s3:*", "logs:*"], "Resource": "*" }
  ]
}
```
