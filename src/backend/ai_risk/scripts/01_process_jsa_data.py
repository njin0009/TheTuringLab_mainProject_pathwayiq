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