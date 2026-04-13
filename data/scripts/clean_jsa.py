"""
clean_jsa.py
Cleans the Jobs and Skills Australia Occupation Shortage List CSV.
Output: data/processed/shortage_labels.json

Source: https://www.jobsandskills.gov.au/data/occupation-shortage-list
Update: Quarterly
"""
import pandas as pd
import json
from pathlib import Path

RAW  = Path(__file__).parent.parent / "raw"  / "jsa_shortage_list.csv"
OUT  = Path(__file__).parent.parent / "processed"

def clean():
    df = pd.read_csv(RAW)

    # Normalise column names
    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")

    # Keep only relevant columns
    df = df[["anzsco_code", "occupation_title", "shortage_status", "national_shortage"]]
    df = df.rename(columns={
        "anzsco_code":     "anzsco",
        "occupation_title":"title",
        "shortage_status": "status",
        "national_shortage":"national",
    })

    # Clean ANZSCO codes to 6-digit string
    df["anzsco"] = df["anzsco"].astype(str).str.strip().str.zfill(6)

    # Map shortage labels
    df["shortage"]     = df["status"].str.contains("Shortage", case=False, na=False)
    df["disappearing"] = df["status"].str.contains("Surplus|Decline", case=False, na=False)

    result = df.set_index("anzsco")[["title","shortage","disappearing"]].to_dict(orient="index")

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "shortage_labels.json").write_text(json.dumps(result, indent=2))
    print(f"✓ shortage_labels.json — {len(result)} occupations")

if __name__ == "__main__":
    clean()
