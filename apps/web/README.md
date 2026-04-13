<div align="center">

# PathwayIQ

**Career guidance platform for Victorian Year 10–12 students**

[![Status](https://img.shields.io/badge/status-active%20development-00C46A?style=flat-square)](.)
[![Team](https://img.shields.io/badge/team-TA28%20The%20Turing%20Lab-0A1628?style=flat-square)](.)
[![Unit](https://img.shields.io/badge/unit-FIT5120%20Monash%20University-blue?style=flat-square)](.)
[![License](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)](.)

</div>

---

## What is PathwayIQ?

Most Year 10–12 students in Victoria are expected to make life-changing study and career decisions without meaningful support. School career advisors are overstretched, and existing tools are generic, outdated, or inaccessible.

**PathwayIQ** gives every student access to the personalised career guidance that schools cannot provide at scale — free, no login required, powered entirely by open Australian government data.

> *"I'm 17. I have to choose what to study next year. Nobody has really sat down with me and explained what my options actually are."*

---

## Table of Contents

- [Problem & Solution](#problem--solution)
- [Live Demo](#live-demo)
- [Architecture Overview](#architecture-overview)
- [Repository Structure](#repository-structure)
- [Frontend](#frontend)
- [Backend](#backend)
- [Data Layer](#data-layer)
- [Design System](#design-system)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Team](#team)

---

## Problem & Solution

| Student pain point | PathwayIQ solution |
|---|---|
| No access to career advisers | AI-powered quiz + instant career matching |
| No career expos or profession talks | Real salary data + day-in-the-life career cards |
| Can't plan for the future | 15-year career path + education cost + time-to-entry |
| Don't know which path to take | Quiz → matched careers → Uni / TAFE / Apprenticeship |
| Unaware of disappearing or shortage jobs | Shortage / Disappearing / AI-risk labels on every career card |

**Design principles:**
- ❌ No login, no account
- ❌ No personal data stored at any point
- ✅ Stateless — every request is independent
- ✅ Mobile-first
- ✅ Powered entirely by open government datasets

---

## Live Demo

| Environment | URL | Status |
|---|---|---|
| Production | `https://pathwayiq.vercel.app` | 🔧 In progress |
| Staging | `https://pathwayiq-dev.vercel.app` | 🔧 In progress |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER / CLIENT                         │
│         Next.js 16 · React 19 · TypeScript · Tailwind v4        │
│                                                                 │
│   Home → Quiz → Explore Careers → Compare → Career Report       │
└────────────────────────┬────────────────────────────────────────┘
                         │  HTTPS / REST
┌────────────────────────▼────────────────────────────────────────┐
│                   AWS API GATEWAY                               │
│              (ap-southeast-2 · single endpoint)                 │
└──────┬──────────────────┬──────────────────────┬───────────────┘
       │                  │                      │
┌──────▼──────┐  ┌────────▼────────┐  ┌─────────▼──────────┐
│ Quiz Engine │  │  Search Engine  │  │  Report Generator  │
│  Lambda     │  │    Lambda       │  │     Lambda         │
│  Node.js    │  │   Node.js       │  │    Node.js         │
└──────┬──────┘  └────────┬────────┘  └─────────┬──────────┘
       │                  │                      │
┌──────▼──────────────────▼──────────────────────▼──────────────┐
│                    DATA LAYER (AWS S3 + Lambda)                │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ JSA / DESE   │  │ NCVER / VTAC │  │  Oxford / ABS /   │   │
│  │ Shortage +   │  │ Education    │  │  OECD             │   │
│  │ Job demand   │  │ pathways     │  │  AI risk scores   │   │
│  └──────────────┘  └──────────────┘  └───────────────────┘   │
└───────────────────────────────────────────────────────────────┘

                  No database · No user data stored
```

---

## Repository Structure

```
pathwayiq/
│
├── 📁 frontend/                      ← Next.js application
│   ├── app/
│   │   ├── layout.tsx                ← Root layout
│   │   ├── page.tsx                  ← Scene router (activeIdx state)
│   │   └── globals.css
│   ├── components/
│   │   └── ui/                       ← All reusable components (shadcn pattern)
│   │       ├── animated-shader-hero.tsx   ← WebGL hero (Home)
│   │       ├── liquid-metal-button.tsx    ← Nav buttons (@paper-design/shaders)
│   │       └── bottom-nav.tsx             ← Fixed bottom navigation
│   ├── lib/
│   │   └── utils.ts                  ← cn() utility
│   ├── public/                       ← Static assets
│   ├── package.json
│   └── tsconfig.json
│
├── 📁 backend/                       ← AWS Lambda functions (Node.js)
│   ├── quiz-engine/
│   │   ├── handler.js                ← POST /quiz → career matches
│   │   └── matcher.js                ← Scoring algorithm
│   ├── search-engine/
│   │   ├── handler.js                ← GET /careers?q=nurse
│   │   └── autocomplete.js           ← Keyword + interest tag search
│   ├── report-generator/
│   │   ├── handler.js                ← GET /report/:careerId
│   │   └── builder.js                ← Assembles all data for report
│   └── shared/
│       ├── data-client.js            ← Unified S3 data access layer
│       └── labels.js                 ← Shortage / AI risk label logic
│
├── 📁 data/                          ← Data pipeline (Python)
│   ├── raw/                          ← Source files (gitignored)
│   │   ├── jsa_shortage_list.csv
│   │   ├── dese_skills_priority.csv
│   │   ├── ncver_tafe_pathways.csv
│   │   ├── vtac_course_data.csv
│   │   ├── abs_automation_index.csv
│   │   └── oxford_employment_future.csv
│   ├── processed/                    ← Cleaned output (uploaded to S3)
│   │   ├── careers.json              ← Master career dictionary
│   │   ├── shortage_labels.json      ← Shortage / disappearing flags
│   │   ├── ai_risk_scores.json       ← AI replacement risk 0–1
│   │   └── education_pathways.json   ← Uni / TAFE / Apprenticeship
│   ├── scripts/
│   │   ├── clean_jsa.py              ← JSA shortage list cleaning
│   │   ├── clean_vtac.py             ← VTAC course data cleaning
│   │   ├── score_ai_risk.py          ← Oxford + ABS → risk score
│   │   └── merge_careers.py          ← Build careers.json master file
│   └── requirements.txt
│
├── 📁 infrastructure/                ← AWS configuration
│   ├── api-gateway.yaml              ← API Gateway routes definition
│   ├── lambda-config.yaml            ← Lambda function configs
│   └── s3-buckets.md                 ← S3 bucket structure docs
│
├── 📁 docs/                          ← Project documentation
│   ├── architecture.md               ← Full system diagram + decisions
│   ├── api-reference.md              ← All API endpoints + payloads
│   ├── data-sources.md               ← Data provenance + update schedule
│   ├── user-flows.md                 ← User flow diagrams (all 5 scenes)
│   └── design-system.md             ← Colours, typography, components
│
├── .github/
│   └── workflows/
│       ├── frontend-ci.yml           ← Lint + type check + build on PR
│       └── data-pipeline.yml         ← Run data scripts on schedule
│
└── README.md                         ← This file
```

---

## Frontend

**Stack:** Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS v4

### Scenes (single-page, `activeIdx` routing)

| Index | Scene | Status | Description |
|---|---|---|---|
| 0 | **Home** | ✅ Done | WebGL shader hero, career search, interest tags |
| 1 | **Quiz** | 🔧 In progress | 4-question interest matcher → career tag output |
| 2 | **Explore** | 🔧 In progress | Search, filters, career card grid with JSA labels |
| 3 | **Compare** | 🔧 In progress | Side-by-side salary / AI risk / pathway comparison |
| 4 | **Career Report** | 🔧 In progress | Full personalised report with PDF export |

### Key components

| Component | File | Purpose |
|---|---|---|
| `AnimatedShaderHero` | `components/ui/animated-shader-hero.tsx` | WebGL full-screen hero background |
| `LiquidMetalButton` | `components/ui/liquid-metal-button.tsx` | Iridescent nav button via `@paper-design/shaders` |
| `BottomNav` | `components/ui/bottom-nav.tsx` | Fixed bottom navigation bar |

### Why Next.js, not Vue?

Short answer: the three core UI components already built (`LiquidMetalButton`, `AnimatedShaderHero`, `BottomNav`) all depend on React-first libraries — `@paper-design/shaders`, Framer Motion, and the shadcn pattern. Switching to Vue mid-project would mean rebuilding all three from scratch.

See [`docs/architecture.md`](./docs/architecture.md) for the full comparison.

---

## Backend

**Stack:** Node.js 20.x · AWS Lambda · AWS API Gateway

### API Endpoints

| Method | Path | Lambda | Description |
|---|---|---|---|
| `POST` | `/quiz` | `quiz-engine` | Submit quiz answers → ranked career matches |
| `GET` | `/careers` | `search-engine` | Search careers by keyword or interest tag |
| `GET` | `/careers/:id` | `search-engine` | Single career detail |
| `GET` | `/report/:careerId` | `report-generator` | Full career report payload |
| `GET` | `/compare` | `report-generator` | Side-by-side two careers |

### Quiz matching algorithm

```
User answers (4 questions)
        ↓
  Interest tags extracted
  (e.g. Analytical · Social · Creative)
        ↓
  Scored against careers.json
  (demand weight × interest match × shortage bonus)
        ↓
  Top 3–5 matched careers returned
  with Shortage / AI-risk / Growth labels
```

### Design principles

- **Stateless** — no session, no DB writes, no user data retained
- **Single responsibility** — each Lambda does one thing
- **Swappable data layer** — `shared/data-client.js` abstracts S3 reads; source can be changed without touching business logic

---

## Data Layer

**Stack:** Python 3.11 · AWS S3 · pandas · requests

### Data Sources

| Source | Data | Update frequency | Licence |
|---|---|---|---|
| [Jobs and Skills Australia (JSA)](https://www.jobsandskills.gov.au) | Occupation shortage list, job demand forecasts to 2033, salary medians | Quarterly | Open Government Licence |
| [DESE Skills Priority List](https://www.dewr.gov.au) | National skills in demand, VET priorities | Annual | CC BY 4.0 |
| [NCVER](https://www.ncver.edu.au) | TAFE enrolments, apprenticeship completion rates | Annual | CC BY |
| [VTAC](https://vtac.edu.au) | Course ATAR cutoffs, course-to-career pathways | Annual (Jan) | Public data |
| [ABS](https://www.abs.gov.au) | Automation exposure index by occupation | Annual | CC BY 4.0 |
| [Oxford Future of Employment](https://www.oxfordmartin.ox.ac.uk) | AI displacement probability by occupation | Research paper | Academic use |

### Pipeline

```
raw CSV / XLSX (S3 raw/)
        ↓
  Python cleaning scripts
  (normalise ANZSCO codes, fill nulls, standardise names)
        ↓
  Score AI risk (Oxford probability × ABS automation index)
        ↓
  Assign labels:  ↑ Shortage · ↓ Disappearing · ⚠ High AI risk
        ↓
  Output: careers.json · shortage_labels.json
          ai_risk_scores.json · education_pathways.json
        ↓
  Upload to S3 (processed/)
        ↓
  Lambda reads on-demand (no DB)
```

### Processed data schema (`careers.json`)

```json
{
  "id": "software-engineer",
  "title": "Software Engineer",
  "anzsco": "261313",
  "industry": "Technology",
  "salary": { "entry": 85000, "mid": 115000, "senior": 150000 },
  "demand": { "vic": "High", "national": "High" },
  "growth_10yr": 22,
  "ai_risk": 0.18,
  "shortage": true,
  "disappearing": false,
  "labels": ["↑ Shortage", "Low AI risk"],
  "pathways": [
    { "type": "University", "duration": "3 yrs", "cost": "HECS ~$32k" },
    { "type": "Bootcamp",   "duration": "6 mo",  "cost": "~$15k" }
  ],
  "atar_typical": 80,
  "interests": ["Analytical", "Technical", "Problem-solving"]
}
```

---

## Design System

### Colour palette

```
Primary green   #00C46A   — CTA buttons, active states, shortage labels
Dark green      #007A42   — hover darken
Navy base       #0A1628   — page background (Home, warm-black)
Cold navy       #020816   — page background (Report, cool-black)
Amber           #F5A623   — AI risk warnings, medium risk
Coral           #E85D4A   — disappearing career labels, high risk
```

Background colour interpolates from warm-black (Home) → cold-black (Report) as the user advances through scenes.

### Typography

| Role | Font | Weight |
|---|---|---|
| Display / headings | Syne | 700, 800 |
| Body / UI labels | DM Sans | 400, 500 |

### Component conventions

- `"use client"` on any component using hooks or browser APIs
- Runtime-changing values → inline `style` (WebGL dimensions, animation state)
- Static layout → Tailwind utilities
- Conditional class merging → `cn()` from `lib/utils.ts`
- All components in `/components/ui/` — owned, not black-box

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- AWS CLI configured (for backend / data work)

### Frontend (local dev)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Backend (local test)

```bash
cd backend/quiz-engine
npm install
node handler.js   # or use AWS SAM for local Lambda emulation
```

### Data pipeline

```bash
cd data
pip install -r requirements.txt

# Run individual scripts
python scripts/clean_jsa.py
python scripts/score_ai_risk.py
python scripts/merge_careers.py

# Output lands in data/processed/
```

### Environment variables

**Frontend** (`.env.local`):
```env
NEXT_PUBLIC_API_BASE_URL=https://your-api.execute-api.ap-southeast-2.amazonaws.com/prod
```

**Backend Lambda** (set in AWS console or via SAM):
```env
S3_BUCKET=pathwayiq-data
S3_REGION=ap-southeast-2
```

---

## Deployment

| Layer | Platform | Region |
|---|---|---|
| Frontend | Vercel (auto-deploy on `main`) | Global CDN |
| API Gateway | AWS | ap-southeast-2 (Sydney) |
| Lambda functions | AWS | ap-southeast-2 (Sydney) |
| Data / S3 | AWS S3 | ap-southeast-2 (Sydney) |

### CI/CD

- Push to `main` → Vercel auto-deploys frontend
- PR on `main` → GitHub Actions runs `tsc --noEmit` + `next build`
- Data pipeline re-runs via GitHub Actions on schedule (monthly) or manual trigger

---

## Roadmap

### Iteration 1 (current — April 2026)
- [x] Project architecture + tech stack
- [x] Home scene — WebGL shader hero
- [x] Bottom navigation — liquid metal buttons
- [x] Prototype: horizontal scroll story mechanic
- [ ] Quiz scene — 4-question flow
- [ ] Explore scene — career card grid

### Iteration 2 (May 2026)
- [ ] Compare scene — side-by-side career comparison
- [ ] Career Report scene — full personalised report
- [ ] PDF export — `@react-pdf/renderer`
- [ ] Backend Lambda — quiz matching endpoint
- [ ] Backend Lambda — career search endpoint

### Iteration 3 (June 2026)
- [ ] Data pipeline — JSA + ABS cleaning scripts
- [ ] AI risk scoring — Oxford × ABS composite score
- [ ] Backend Lambda — report generation endpoint
- [ ] Full end-to-end integration test
- [ ] Vercel production deployment

---

## Team

**FIT5120 Industry Experience Studio — Team TA28 "The Turing Lab"**
Monash University · 2026

| Name | Role | Responsibilities |
|---|---|---|
| NuoJin / Nora | Product Manager · Frontend | Architecture decisions, UI components, PM documentation |
| Steve Saji Philip | Frontend Developer | Scene implementation, component development |
| Lee Kai Chun (Bill) | Backend · AWS | Lambda functions, API Gateway, S3 setup |
| Yanqing Zhu (Sela) | Data · API Integration | Python pipeline, data cleaning, JSA/ABS processing |
| Prangige Peiris (Shavinthi) | UI Design · Research | Figma prototypes, user research, design system |

**Mentors:** Himanshu, Patrick
**Teaching staff:** Nelly

---

## Acknowledgements

Data provided by:
- [Jobs and Skills Australia](https://www.jobsandskills.gov.au) — Open Government Licence
- [Department of Employment and Workplace Relations (DEWR)](https://www.dewr.gov.au) — CC BY 4.0
- [National Centre for Vocational Education Research (NCVER)](https://www.ncver.edu.au) — CC BY
- [Australian Bureau of Statistics (ABS)](https://www.abs.gov.au) — CC BY 4.0
- Oxford Martin School — [The Future of Employment](https://www.oxfordmartin.ox.ac.uk/downloads/academic/future-of-employment.pdf)

---

## License

MIT — for academic use, FIT5120 Industry Experience Studio, Monash University 2026.

