"""
score_ai_risk.py
Produces AI automation risk scores (0–1) per ANZSCO occupation.

Methodology:
  score = 0.6 × oxford_probability + 0.4 × abs_automation_index

Sources:
  - Oxford Future of Employment (Frey & Osborne 2013, updated mapping)
  - ABS Occupation Automation Exposure Index
Output: data/processed/ai_risk_scores.json
"""
import pandas as pd
import json
from pathlib import Path

RAW = Path(__file__).parent.parent / "raw"
OUT = Path(__file__).parent.parent / "processed"

def score():
    # Load Oxford probabilities (col: anzsco, probability)
    oxford = pd.read_csv(RAW / "oxford_employment_future.csv")
    oxford.columns = oxford.columns.str.strip().str.lower()
    oxford["anzsco"] = oxford["anzsco"].astype(str).str.zfill(6)
    oxford = oxford[["anzsco", "probability"]].rename(columns={"probability": "oxford"})

    # Load ABS automation index (col: anzsco, automation_index 0–1)
    abs_df = pd.read_csv(RAW / "abs_automation_index.csv")
    abs_df.columns = abs_df.columns.str.strip().str.lower()
    abs_df["anzsco"] = abs_df["anzsco"].astype(str).str.zfill(6)
    abs_df = abs_df[["anzsco", "automation_index"]].rename(columns={"automation_index": "abs"})

    merged = oxford.merge(abs_df, on="anzsco", how="outer").fillna(0.5)

    # Composite score — weighted average
    merged["score"] = (0.6 * merged["oxford"] + 0.4 * merged["abs"]).round(3)
    merged["score"] = merged["score"].clip(0.0, 1.0)

    result = dict(zip(merged["anzsco"], merged["score"]))

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "ai_risk_scores.json").write_text(json.dumps(result, indent=2))
    print(f"✓ ai_risk_scores.json — {len(result)} occupations scored")

if __name__ == "__main__":
    score()
