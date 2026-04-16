# PathwayIQ

**Career guidance platform for Victorian Year 10–12 students**

[![CI](https://github.com/YOUR_ORG/pathwayiq/actions/workflows/frontend-ci.yml/badge.svg)](.)
[![Team](https://img.shields.io/badge/team-TA28%20The%20Turing%20Lab-0A1628?style=flat-square)](.)
[![Unit](https://img.shields.io/badge/FIT5120-Monash%20University%202026-blue?style=flat-square)](.)

---

## What is PathwayIQ?

PathwayIQ helps Year 10–12 students in Victoria explore careers, match their interests to real jobs, compare study pathways, and download a personalised career report — all powered by open Australian government data.

No login. No user data stored. Free, forever.

```
Home → Quiz → Explore → Compare → Career Report
```

---

## Repository structure

```
pathwayiq/                          ← monorepo root (npm workspaces)
│
├── apps/
│   ├── web/                        ← Next.js 16 frontend (Cloudflare Pages)
│   │   ├── app/                    ← App Router (layout, page, globals.css)
│   │   ├── components/ui/          ← shadcn-pattern components
│   │   │   ├── animated-shader-hero.tsx
│   │   │   ├── liquid-metal-button.tsx
│   │   │   └── bottom-nav.tsx
│   │   ├── scenes/                 ← one file per scene
│   │   │   ├── home.tsx
│   │   │   ├── quiz.tsx
│   │   │   ├── explore.tsx
│   │   │   ├── compare.tsx
│   │   │   └── report.tsx
│   │   ├── hooks/
│   │   │   ├── useCareerSearch.ts
│   │   │   └── useQuizState.ts
│   │   └── lib/
│   │       ├── api-client.ts       ← all backend calls centralised here
│   │       └── utils.ts            ← cn() helper
│   │
│   └── api/                        ← AWS Lambda functions (Node.js 20.x)
│       ├── serverless.yml          ← Serverless Framework config
│       └── src/
│           ├── functions/          ← one Lambda per endpoint
│           │   ├── quiz.ts         ← POST /quiz
│           │   ├── search.ts       ← GET /careers
│           │   ├── career.ts       ← GET /careers/:id
│           │   ├── report.ts       ← GET /report/:id
│           │   └── compare.ts      ← GET /compare
│           ├── services/           ← business logic (testable, no AWS deps)
│           │   ├── matcher.ts      ← quiz scoring algorithm
│           │   ├── labeller.ts     ← shortage / AI-risk label logic
│           │   └── data-client.ts  ← R2 read abstraction layer
│           ├── ai-service/         ← reserved for Iteration 3 (Bedrock)
│           │   └── index.ts
│           └── types/
│               └── career.ts       ← shared TypeScript interfaces
│
├── data/                           ← Python 3.11 data pipeline
│   ├── raw/                        ← gitignored — place source CSVs here
│   ├── processed/                  ← output JSON files (committed + on R2)
│   │   ├── careers.json
│   │   ├── shortage_labels.json
│   │   ├── ai_risk_scores.json
│   │   └── education_pathways.json
│   ├── scripts/
│   │   ├── clean_jsa.py
│   │   ├── score_ai_risk.py
│   │   ├── merge_careers.py
│   │   └── upload_r2.py
│   └── requirements.txt
│
├── infrastructure/
│   ├── env-variables.md            ← all env vars documented
│   └── r2-structure.md             ← Cloudflare R2 bucket layout
│
├── docs/
│   ├── api-reference.md            ← all endpoints + request/response shapes
│   └── data-sources.md             ← data provenance + licences
│
├── .github/workflows/
│   ├── frontend-ci.yml             ← type check + build on every PR
│   ├── backend-deploy.yml          ← deploy Lambda on merge to main
│   └── data-pipeline.yml           ← monthly data refresh (cron)
│
├── package.json                    ← npm workspaces root
├── .gitignore
└── README.md
```

---

## Tech stack

| Layer | Technology | Platform | Free tier |
|---|---|---|---|
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind v4 | Cloudflare Pages | Unlimited bandwidth, permanent |
| API | AWS API Gateway (HTTP API) | AWS ap-southeast-2 | 1M req/mo permanent |
| Compute | AWS Lambda Node.js 20.x | AWS ap-southeast-2 | 1M req/mo permanent |
| Data storage | Cloudflare R2 | Cloudflare | 10 GB, zero egress, permanent |
| AI (Iter 3) | AWS Bedrock model integration | AWS ap-southeast-2 | Pay per use |
| IaC | Serverless Framework | — | Free open source |
| CI/CD | GitHub Actions | GitHub | Free for public repos |

---

## Getting started

### Prerequisites
- Node.js 20+
- Python 3.11+
- AWS CLI configured
- Cloudflare account (for R2)

### Frontend

```bash
cd apps/web
npm install
cp .env.example .env.local        # add NEXT_PUBLIC_API_BASE_URL
npm run dev                        # http://localhost:3000
```

### Backend (local)

```bash
cd apps/api
npm install
npx serverless offline             # mocks Lambda + API Gateway locally
```

### Data pipeline

```bash
cd data
pip install -r requirements.txt

# Place raw CSVs in data/raw/ (see docs/data-sources.md for filenames)
python scripts/clean_jsa.py
python scripts/score_ai_risk.py
python scripts/merge_careers.py
python scripts/upload_r2.py       # requires R2 env vars
```

### Deploy

```bash
# Frontend — push to main, Cloudflare Pages auto-deploys
git push origin main

# Backend — GitHub Actions deploys on push to apps/api/**
# Or manually:
cd apps/api && npx serverless deploy --stage prod
```

See `infrastructure/env-variables.md` for all required secrets.

---

## Epics and iteration plan

| Epic | Description | Iteration |
|---|---|---|
| 1 | Career keyword search and autocomplete | 1 |
| 2 | Career interest quiz | 1–2 |
| 3 | Career card display and filtering | 1 |
| 4 | Career detail modal with pathway comparison | 2 |
| 5 | 15-year career progression timeline | 2–3 |
| 6 | AI displacement risk indicator | 3 |
| 7 | Personalised PDF report download | 2–3 |
| 8 | Accessibility, responsiveness, data transparency | All |

---

## Team

**FIT5120 Industry Experience Studio — Team TA28 "The Turing Lab", Monash University 2026**

| Name | Role |
|---|---|
| NuoJin / Nora | Frontend Developer |
| Steve Saji Philip | Backend Developer |
| Lee Kai Chun (Bill) | Backend · AWS |
| Yanqing Zhu (Sela) |Research|
| Prangige Peiris (Shavinthi) | Data · API Integration  |

Mentors: Himanshu, Patrick · Teaching staff: Nelly

---

## License

MIT — academic use, FIT5120 Industry Experience Studio, Monash University 2026.
