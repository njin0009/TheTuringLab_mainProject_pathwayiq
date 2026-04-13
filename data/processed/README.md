# data/processed/

Output files from the Python pipeline. These are uploaded to Cloudflare R2 and read by Lambda at runtime.

> `data/raw/` is gitignored — source CSVs are not committed.  
> `data/processed/` **is** committed so the repo is self-contained for review.

---

## careers.json

Master career dictionary. Shape of each item:

```json
{
  "id":           "software-engineer",
  "title":        "Software Engineer",
  "anzsco":       "261313",
  "industry":     "Technology",
  "salary":       { "entry": 85000, "mid": 115000, "senior": 150000 },
  "demand":       { "vic": "High", "national": "High" },
  "growth_10yr":  22,
  "ai_risk":      0.18,
  "shortage":     true,
  "disappearing": false,
  "labels":       [],
  "pathways":     [...],
  "atar_typical": 80,
  "interests":    ["Analytical", "Technical", "Problem-solving"]
}
```

## ai_risk_scores.json

Map of ANZSCO code → composite AI risk score (0–1).

```json
{ "261313": 0.18, "411111": 0.72 }
```

Score = 0.6 × Oxford probability + 0.4 × ABS automation index.

## shortage_labels.json

Map of ANZSCO code → shortage / disappearing flags.

```json
{ "261313": { "title": "Software Engineer", "shortage": true, "disappearing": false } }
```

## education_pathways.json

Map of ANZSCO code → array of pathway objects. Manually curated from NCVER and VTAC data.

---

## Pipeline run order

```bash
cd data
pip install -r requirements.txt

python scripts/clean_jsa.py          # → shortage_labels.json
python scripts/score_ai_risk.py      # → ai_risk_scores.json
python scripts/merge_careers.py      # → careers.json  (reads the above two)
python scripts/upload_r2.py          # → upload all to Cloudflare R2
```
