"""
merge_careers.py
Merges all processed data sources into a single careers.json master file.

Input files (all in data/processed/):
  shortage_labels.json  — from clean_jsa.py
  ai_risk_scores.json   — from score_ai_risk.py
  education_pathways.json — manually curated from NCVER / VTAC

Output: data/processed/careers.json
"""
import json
import pandas as pd
from pathlib import Path

RAW = Path(__file__).parent.parent / "raw"
OUT = Path(__file__).parent.parent / "processed"

def merge():
    # Load DESE Graduate Outcomes salary data
    dese = pd.read_csv(RAW / "dese_graduate_outcomes.csv")
    dese.columns = dese.columns.str.strip().str.lower()
    dese["anzsco"] = dese["anzsco"].astype(str).str.zfill(6)

    # Load JSA labour market insights (demand, growth)
    jsa = pd.read_csv(RAW / "jsa_labour_market_insights.csv")
    jsa.columns = jsa.columns.str.strip().str.lower()
    jsa["anzsco"] = jsa["anzsco"].astype(str).str.zfill(6)

    # Load processed enrichment files
    shortage  = json.loads((OUT / "shortage_labels.json").read_text())
    ai_risk   = json.loads((OUT / "ai_risk_scores.json").read_text())
    pathways  = json.loads((OUT / "education_pathways.json").read_text())

    careers = []
    for _, row in jsa.iterrows():
        anzsco = row["anzsco"]
        sal    = dese[dese["anzsco"] == anzsco]

        career = {
            "id":           row["title"].lower().replace(" ", "-").replace("/", "-"),
            "title":        row["title"],
            "anzsco":       anzsco,
            "industry":     row.get("industry", ""),
            "salary": {
                "entry":  int(sal["entry_salary"].iloc[0])  if not sal.empty else 0,
                "mid":    int(sal["mid_salary"].iloc[0])    if not sal.empty else 0,
                "senior": int(sal["senior_salary"].iloc[0]) if not sal.empty else 0,
            },
            "demand": {
                "vic":      row.get("vic_demand", "Medium"),
                "national": row.get("national_demand", "Medium"),
            },
            "growth_10yr":  float(row.get("growth_10yr", 0)),
            "ai_risk":      ai_risk.get(anzsco, 0.5),
            "shortage":     shortage.get(anzsco, {}).get("shortage", False),
            "disappearing": shortage.get(anzsco, {}).get("disappearing", False),
            "labels":       [],  # populated at runtime by labeller.ts
            "pathways":     pathways.get(anzsco, []),
            "atar_typical": row.get("atar_typical", None),
            "interests":    row.get("interest_tags", "").split("|") if row.get("interest_tags") else [],
        }
        careers.append(career)

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "careers.json").write_text(json.dumps(careers, indent=2))
    print(f"✓ careers.json — {len(careers)} careers written")

if __name__ == "__main__":
    merge()
