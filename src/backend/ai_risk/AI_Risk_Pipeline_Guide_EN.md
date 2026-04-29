# PathwayIQ — AI Risk Feature: Step-by-Step Development Guide
**Team TA28 | MAI Student | For use with Claude Code in VS Code**

---

## What This Guide Is For

This guide walks you through building the AI Displacement Risk feature for PathwayIQ.
You will process real government data from Jobs and Skills Australia (JSA), load it into a MySQL database,
and connect it to the backend API so the frontend can display a risk badge on each career card.

Hand this file to Claude Code and say:
> **"Please follow this guide step by step and help me complete each task. Ask me before moving to the next step."**

---

## Data Summary (Already Confirmed)

| Item | Detail |
|------|--------|
| Source file | `JSA_Gen_AI_Capacity_Study_AP_Publication_Chart_Data_20250930.xlsx` |
| Sheet to use | `APA Figure 2` |
| Total occupations | 357 |
| Key columns | `anzsco_code`, `occupation_name`, `automation_score`, `augmentation_score` |
| Processed output | `occupation_risk_final.csv` (already generated) |

**JSA Official Label Definitions** (from JSA report, Page 19):

| Score Range | Label |
|-------------|-------|
| 0.70 and above | High |
| 0.50 to 0.69 | Medium |
| 0.25 to 0.49 | Low |
| Below 0.25 | Very Low |

---

## Folder Structure to Create

Inside the existing team GitHub repository, create the following folder structure.
Do NOT delete or move any existing files.

```
src/
└── backend/
    └── ai_risk/
        ├── data/
        │   ├── raw/                  ← Place the original Excel file here (NOT committed to Git)
        │   └── processed/            ← Place occupation_risk_final.csv here (committed to Git)
        ├── scripts/
        │   ├── 01_process_jsa_data.py
        │   └── 02_import_to_mysql.py
        ├── sql/
        │   └── create_occupation_risk.sql
        └── README.md
```

Also add the following lines to the `.gitignore` file in the root of the repository:

```
# Raw data files — do not commit large or sensitive source files
src/backend/ai_risk/data/raw/
*.xlsx
```

---

## Step 1 — Create the Folder Structure

**Ask Claude Code to do this:**
> "Please create the folder structure described in the guide inside `src/backend/ai_risk/`. Also update the `.gitignore` file."

**Then commit:**
```
feat(ai-risk): scaffold ai_risk folder structure
```

---

## Step 2 — Data Wrangling Script

Create the file `src/backend/ai_risk/scripts/01_process_jsa_data.py` with the following content:

```python
"""
PathwayIQ — JSA AI Exposure Data Wrangling Script
Data Source: JSA Generative AI Capacity Study, 2025
Sheet Used: APA Figure 2 (357 occupations, unit-level ANZSCO data)

Label Definitions (JSA Report, Page 19):
  High     >= 0.70
  Medium   0.50 to 0.69
  Low      0.25 to 0.49
  Very Low < 0.25
"""

import pandas as pd

# ----------------------------------------------------------------
# Step 1: Read raw Excel
# ----------------------------------------------------------------
print("Reading JSA data from Excel...")

df = pd.read_excel(
    "data/raw/JSA_Gen_AI_Capacity_Study_AP_Publication_Chart_Data_20250930.xlsx",
    sheet_name="APA Figure 2",
    header=2    # The real column headers are on row 3 (index 2)
)

# Rename columns (the original names are messy)
df.columns = [
    'automation_score', 'augmentation_score', 'anzsco_code',
    'occupation_name', 'colour_theme', 'c5', 'c6', 'c7', 'notes'
]

# ----------------------------------------------------------------
# Step 2: Clean the data
# ----------------------------------------------------------------

# Keep only the columns we need
df = df[['automation_score', 'augmentation_score', 'anzsco_code', 'occupation_name']].copy()

# Remove empty rows
df = df.dropna(subset=['anzsco_code', 'occupation_name'])

# Keep only real occupation rows (anzsco_code must be a number)
df = df[df['anzsco_code'].apply(lambda x: str(x).strip().isdigit())]

# Standardise data types
df['anzsco_code'] = df['anzsco_code'].astype(int).astype(str)
df['automation_score'] = pd.to_numeric(df['automation_score'], errors='coerce')
df['augmentation_score'] = pd.to_numeric(df['augmentation_score'], errors='coerce')

print(f"Records after cleaning: {len(df)}")

# ----------------------------------------------------------------
# Step 3: Assign risk labels using JSA official thresholds
# ----------------------------------------------------------------

def assign_label(score):
    if score >= 0.70:
        return 'High'
    elif score >= 0.50:
        return 'Medium'
    elif score >= 0.25:
        return 'Low'
    else:
        return 'Very Low'

df['augmentation_level'] = df['augmentation_score'].apply(assign_label)
df['automation_level'] = df['automation_score'].apply(assign_label)

# ----------------------------------------------------------------
# Step 4: Generate explanation text for the frontend badge tooltip
# ----------------------------------------------------------------

def generate_explanation(row):
    aug_pct = int(row['augmentation_score'] * 100)
    level = row['augmentation_level']

    if level == 'High':
        return (
            f"JSA rates this role with {aug_pct}% AI augmentation exposure. "
            f"Tasks in this occupation are highly likely to be reshaped by generative AI. "
            f"Consider building skills that complement AI tools."
        )
    elif level == 'Medium':
        return (
            f"JSA rates this role with {aug_pct}% AI augmentation exposure. "
            f"Some tasks may be assisted by AI, but human judgment and expertise remain central."
        )
    elif level == 'Low':
        return (
            f"JSA rates this role with {aug_pct}% AI augmentation exposure. "
            f"Limited AI disruption is expected — skills in this area are likely to remain in demand."
        )
    else:
        return (
            f"JSA rates this role with {aug_pct}% AI augmentation exposure. "
            f"This role has very low AI exposure and is unlikely to be significantly affected."
        )

df['explanation'] = df.apply(generate_explanation, axis=1)
df['data_source'] = 'JSA Generative AI Capacity Study, 2025'

# ----------------------------------------------------------------
# Step 5: Check the distribution looks reasonable
# ----------------------------------------------------------------
print("\nAugmentation Level Distribution:")
print(df['augmentation_level'].value_counts())

print("\nAutomation Level Distribution:")
print(df['automation_level'].value_counts())

print("\nSample output (first 5 rows):")
print(df[['anzsco_code', 'occupation_name', 'augmentation_level', 'automation_level']].head())

# ----------------------------------------------------------------
# Step 6: Save the processed output
# ----------------------------------------------------------------
output_cols = [
    'anzsco_code', 'occupation_name',
    'automation_score', 'augmentation_score',
    'automation_level', 'augmentation_level',
    'explanation', 'data_source'
]

final = df[output_cols].sort_values('anzsco_code').reset_index(drop=True)
final.to_csv("data/processed/occupation_risk_final.csv", index=False)
print(f"\nSaved {len(final)} records to data/processed/occupation_risk_final.csv")
```

**How to run:**
```bash
cd src/backend/ai_risk
pip install pandas openpyxl
python scripts/01_process_jsa_data.py
```

**Expected output:**
```
Records after cleaning: 357
Augmentation Level Distribution:
Medium    186
High      117
Low        54

Saved 357 records to data/processed/occupation_risk_final.csv
```

**Then commit:**
```
feat(ai-risk): add JSA data wrangling script with JSA label definitions
```

---

## Step 3 — MySQL Table Schema

Create the file `src/backend/ai_risk/sql/create_occupation_risk.sql`:

```sql
-- PathwayIQ: Occupation AI Risk Table
-- Source: JSA Generative AI Capacity Study, 2025
-- 357 occupations with ANZSCO codes, exposure scores, and risk labels

CREATE TABLE IF NOT EXISTS occupation_risk (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    anzsco_code         VARCHAR(10) NOT NULL,
    occupation_name     VARCHAR(255) NOT NULL,
    automation_score    FLOAT,
    augmentation_score  FLOAT,
    automation_level    ENUM('Very Low', 'Low', 'Medium', 'High') NOT NULL,
    augmentation_level  ENUM('Very Low', 'Low', 'Medium', 'High') NOT NULL,
    explanation         TEXT,
    data_source         VARCHAR(200) DEFAULT 'JSA Generative AI Capacity Study, 2025',
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_anzsco (anzsco_code),
    INDEX idx_augmentation_level (augmentation_level)
);
```

**Then commit:**
```
feat(ai-risk): add MySQL schema for occupation_risk table
```

---

## Step 4 — Import CSV into MySQL

Create the file `src/backend/ai_risk/scripts/02_import_to_mysql.py`:

```python
"""
PathwayIQ — Import occupation_risk_final.csv into MySQL
Run this AFTER 01_process_jsa_data.py has been run successfully.
"""

import pandas as pd
from sqlalchemy import create_engine

# ----------------------------------------------------------------
# Update these with your actual MySQL credentials
# ----------------------------------------------------------------
DB_USER = "your_username"
DB_PASSWORD = "your_password"
DB_HOST = "localhost"
DB_PORT = "3306"
DB_NAME = "pathwayiq_db"

# ----------------------------------------------------------------
# Load CSV and import into MySQL
# ----------------------------------------------------------------
df = pd.read_csv("data/processed/occupation_risk_final.csv")

engine = create_engine(
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

df.to_sql(
    name="occupation_risk",
    con=engine,
    if_exists="replace",   # Use 'replace' for first run; 'append' to add rows later
    index=False
)

print(f"Successfully imported {len(df)} records into the occupation_risk table.")

# Verify the import
result = pd.read_sql(
    "SELECT augmentation_level, COUNT(*) as count FROM occupation_risk GROUP BY augmentation_level",
    engine
)
print("\nVerification:")
print(result)
```

**How to run:**
```bash
pip install sqlalchemy pymysql
python scripts/02_import_to_mysql.py
```

**Then commit:**
```
feat(ai-risk): add MySQL import script for occupation_risk data
```

---

## Step 5 — Flask API Endpoint

Create the file `src/backend/api/risk_api.py`:

```python
"""
PathwayIQ — AI Risk API Endpoint
Returns the AI exposure level for a given ANZSCO occupation code.
"""

from flask import jsonify, Blueprint
import mysql.connector

risk_bp = Blueprint('risk', __name__)

def get_db():
    return mysql.connector.connect(
        host="localhost",
        user="your_username",
        password="your_password",
        database="pathwayiq_db"
    )

@risk_bp.route("/api/risk/<anzsco_code>", methods=["GET"])
def get_risk(anzsco_code):
    """
    Returns AI exposure data for a given ANZSCO code.
    Example: GET /api/risk/2613
    """
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM occupation_risk WHERE anzsco_code = %s",
        (anzsco_code,)
    )
    result = cursor.fetchone()
    db.close()

    if not result:
        return jsonify({"error": "Occupation not found"}), 404

    return jsonify({
        "anzsco_code": result["anzsco_code"],
        "occupation_name": result["occupation_name"],
        "augmentation_level": result["augmentation_level"],
        "automation_level": result["automation_level"],
        "explanation": result["explanation"],
        "source": result["data_source"]
    })
```

**Register the blueprint in `server.py`:**
```python
from api.risk_api import risk_bp
app.register_blueprint(risk_bp)
```

**Then commit:**
```
feat(ai-risk): add Flask API endpoint for occupation risk lookup
```

---

## Step 6 — VueJS Risk Badge Component

Create the file `src/frontend/components/RiskBadge.vue`:

```vue
<!--
  PathwayIQ — RiskBadge Component
  Displays the AI augmentation exposure level for a given occupation.
  Usage: <RiskBadge anzsco-code="2613" />
-->
<template>
  <div
    v-if="risk"
    class="risk-badge"
    :class="`badge-${risk.augmentation_level.toLowerCase().replace(' ', '-')}`"
  >
    <span class="risk-icon">{{ riskIcon }}</span>
    <span class="risk-label">{{ risk.augmentation_level }} AI Exposure</span>
    <div class="risk-tooltip">{{ risk.explanation }}</div>
  </div>
</template>

<script>
export default {
  name: 'RiskBadge',
  props: {
    anzscoCode: {
      type: String,
      required: true
    }
  },
  data() {
    return { risk: null }
  },
  async mounted() {
    try {
      const res = await fetch(`/api/risk/${this.anzscoCode}`)
      if (res.ok) {
        this.risk = await res.json()
      }
    } catch (err) {
      console.error('Failed to fetch risk data:', err)
    }
  },
  computed: {
    riskIcon() {
      const icons = {
        'High': '🔴',
        'Medium': '🟡',
        'Low': '🟢',
        'Very Low': '🟢'
      }
      return icons[this.risk?.augmentation_level] || ''
    }
  }
}
</script>

<style scoped>
.risk-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  cursor: help;
  position: relative;
}

.badge-high      { background: #FCEBEB; color: #791F1F; }
.badge-medium    { background: #FAEEDA; color: #633806; }
.badge-low       { background: #E1F5EE; color: #085041; }
.badge-very-low  { background: #E1F5EE; color: #085041; }

.risk-tooltip {
  display: none;
  position: absolute;
  bottom: 130%;
  left: 0;
  background: #1E293B;
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  width: 280px;
  line-height: 1.5;
  font-weight: 400;
  z-index: 10;
}

.risk-badge:hover .risk-tooltip {
  display: block;
}
</style>
```

**Then commit:**
```
feat(frontend): add RiskBadge Vue component with tooltip
```

---

## Complete GitHub Commit History

By the end of this feature, your Git log should look like this:

```
feat(frontend): add RiskBadge Vue component with tooltip
feat(ai-risk): add Flask API endpoint for occupation risk lookup
data: add processed JSA occupation risk CSV (357 records)
feat(ai-risk): add MySQL import script for occupation_risk data
feat(ai-risk): add MySQL schema for occupation_risk table
feat(ai-risk): add JSA data wrangling script with JSA label definitions
feat(ai-risk): scaffold ai_risk folder structure
```

Each commit represents one completed, working step. This shows the Industry Mentor
a clear and professional development process.

---

## Demo Script for IM Showcase (30 seconds)

1. Search for **"Software and Applications Programmers"**
   → Career card appears with **🔴 High AI Exposure** badge
2. Hover over the badge
   → Tooltip: *"JSA rates this role with 77% AI augmentation exposure..."*
3. Search for **"Electricians"**
   → Career card appears with **🟢 Low AI Exposure** badge
4. Explain to the IM:
   > *"Unlike other tools, PathwayIQ uses official 2025 government data from Jobs and Skills Australia —
   > not estimates. Every risk rating is backed by a published methodology."*

---

## Output Table Schema Reference

| Column | Example Value |
|--------|--------------|
| anzsco_code | 2613 |
| occupation_name | Software and Applications Programmers |
| automation_score | 0.63 |
| augmentation_score | 0.77 |
| automation_level | Medium |
| augmentation_level | High |
| explanation | JSA rates this role with 77% AI augmentation exposure... |
| data_source | JSA Generative AI Capacity Study, 2025 |

---

*PathwayIQ | FIT5120 Team TA28 | MAI Component | 2026 S1*
*Data: JSA Generative AI Capacity Study, APA Figure 2, 357 occupations*
*Label definitions: JSA Report Page 19 — High ≥0.70 / Medium 0.50–0.69 / Low 0.25–0.49 / Very Low <0.25*
