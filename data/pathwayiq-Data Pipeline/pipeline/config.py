"""
config.py — TA28 Data Group Pipeline
=====================================
Single source of truth for all paths, sheet names, column rename maps,
validation rules, and pipeline settings.

Editing this file is the ONLY thing needed to adapt the pipeline to a
new release of the same data — no script internals need touching.
"""

from pathlib import Path

# ── Directory layout ────────────────────────────────────────────────────────
ROOT        = Path(__file__).parent
RAW_DIR = ROOT.parent / "raw_data"         # where uploads land
SILVER_DIR  = ROOT / "silver"                          # cleaned outputs
PROFILE_DIR = ROOT / "profiles"                        # ydata-profiling HTML
LOG_DIR     = ROOT / "logs"                            # transformation audit logs
CLEANED_DIR = ROOT.parent / "cleaned_data"             # exported CSV outputs

for d in (SILVER_DIR, PROFILE_DIR, LOG_DIR, CLEANED_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ── Raw file registry ────────────────────────────────────────────────────────
RAW_FILES = {
    "osl_filtered": RAW_DIR / "TA28_DG_RawData_OSL2025_ANZSCO6_Filtered_IT1_20260330.csv",
    "osl_full":     RAW_DIR / "TA28_DG_RawData_OSL2025_ANZSCO6_Full_IT1_20260330.xlsx",
    "anzsco_reference": RAW_DIR / "TA28_DG_ANZSCOStandardTitle_I2_20260415.xls",
    "osd":          RAW_DIR / "TA28_DG_RawData_OSD2025_TablesAndFigures_IT1_20260330.xlsx",
    "vet_outcomes": RAW_DIR / "TA28_DG_RawData_VETStudentOutcomes2025_ByQualification_IT1_20260330.xlsx",
    "vnda":         RAW_DIR / "TA28_DG_RawData_VNDA_GraduateOutcomes_2020-21_IT1_20260330.xlsx",
    "seuv":         RAW_DIR / "TA28_DG_RawData_SEUV2025_DataTables_IT1_20260330.xlsx",
    "apprentices":  RAW_DIR / "TA28_DG_RawData_ApprenticesTrainees2025_SepQtr_IT1_20260330.xlsx",
}

# ── Silver output filenames ──────────────────────────────────────────────────
SILVER_FILES = {
    "osl_filtered": SILVER_DIR / "clean_osl_filtered.parquet",
    "osl_full":     SILVER_DIR / "clean_osl_full.parquet",
    "anzsco_reference": SILVER_DIR / "clean_anzsco_reference.parquet",
    "osd":          SILVER_DIR / "clean_osd.parquet",
    "vet_outcomes": SILVER_DIR / "clean_vet_outcomes.parquet",
    "vnda":         SILVER_DIR / "clean_vnda.parquet",
    "seuv":         SILVER_DIR / "clean_seuv.parquet",
    "apprentices":  SILVER_DIR / "clean_apprentices.parquet",
}

# ── Sheet-level config per dataset ──────────────────────────────────────────
#
# Each entry describes WHERE in the workbook the data lives and HOW to
# locate the header row dynamically (header_anchor is a string that, when
# found in a cell, marks the header row above or at that row).
#

OSL_FULL_SHEET_CFG = {
    "sheet":          "2025 OSL (ANZSCO 2022)",
    "header_anchor":  "Occupation code",   # dynamic header detection
    "skiprows_fallback": 7,                 # fallback if anchor not found
}

ANZSCO_REFERENCE_CFG = {
    "sheet": "Table 2",
    "header_row": 5,  # 0-based row index of the Code / Title header
}

OSD_TABLES_CFG = {
    # Tables that have a clean (unit_group, driver) structure
    "driver_tables": {
        "Table 3":  {"header_anchor": "Unit groups", "columns": ["unit_group", "driver_2024", "driver_2025"]},
        "Table 4":  {"header_anchor": "Unit groups", "columns": ["unit_group", "driver_2025"]},
        "Table 5":  {"header_anchor": "Unit groups", "columns": ["unit_group", "driver_2025"]},
        "Table B1": {"header_anchor": "Unit groups", "columns": ["unit_group", "driver_2024"]},
        "Table B2": {"header_anchor": "Unit groups", "columns": ["unit_group", "driver_2025"]},
    },
    "scatter_table": {
        "Figure C1": {"header_anchor": "Unit group",
                      "columns": ["unit_group", "ivi_ue_ratio", "employment_growth_5yr", "shortage_driver"]},
    },
}

VET_OUTCOMES_CFG = {
    "sheet":         "Estimates",
    "header_row":    4,   # row index (0-based) of the actual column header
    "data_start_row": 5,
    # Occupation columns are ANZSCO major group labels → map to major_group_code
    "occ_col_pattern":  "Occupation",   # column name prefix to detect occ columns
    "pct_col_pattern":  "%",
    "industry_col_pattern": "Industry",
}

VNDA_SHEETS_CFG = {
    "national":      {"sheet": "1. National and cohort results",       "header_anchor": "Cohort group"},
    "state":         {"sheet": "2. State results",                     "header_anchor": "Cohort group"},
    "aqf":           {"sheet": "3. AQF results",                       "header_anchor": "Cohort group"},
    "aqf_foe_nat":   {"sheet": "4. AQF-FOE (National) results",        "header_anchor": "AQF_Level"},
    "aqf_foe_state": {"sheet": "5. AQF-FOE (State) results",           "header_anchor": "AQF_Level"},
    "qualification": {"sheet": "6. Qualification results",             "header_anchor": "COURSE_ID"},
    "qual_by_occ":   {"sheet": "7. Qualification by occupation",       "header_anchor": "COURSE_ID"},
}

SEUV_TABLES_CFG = {
    # Each table is a wide timeseries. We melt them to long format.
    # header_anchor = string that, when found in a cell, marks the row
    # containing the year values; label_col_idx = which column holds the
    # metric/category label.
    "timeseries_tables": [f"Table {i}" for i in range(1, 30)],
    "year_row_anchor":   "Employer characteristics",
    "label_col_idx":     1,   # column B holds row labels
}

APPRENTICES_CFG = {
    "sheet":         "Analysis table",
    "drop_cols":     ["CONCAT", "COUNT"],       # formula/helper columns to drop
    "formula_prefix": "=",                       # detect and drop formula cells
    "review_quarter_col": "review_quarter",
    "date_col":      "review_quarter",
    "estimate_types": ["Initial", "1st revision"],
}

# ── Column rename maps ───────────────────────────────────────────────────────
# Lower-snake-case is the target standard for all silver files.
# Maps are partial — only cols that need renaming are listed.
# Unmapped columns are auto-snake-cased by the utils clean_headers() function.

OSL_FILTERED_RENAME = {
    "Code":                    "anzsco_code",
    "Occupation":              "occupation_title",
    "National Shortage Rating": "national_shortage_rating",
    "Victoria Shortage Rating": "victoria_shortage_rating",
    "Skill Level":             "skill_level",
}

OSL_FULL_RENAME = {
    "Occupation code (ANZSCO 2022)": "anzsco_code",
    "Occupation title":              "occupation_title",
    "NS - No Shortage  S - Shortage  R - Regional Shortage  M - Metro Shortage":
                                     "national_shortage_rating",
    "NSW": "nsw_rating", "VIC": "vic_rating", "QLD": "qld_rating",
    "SA":  "sa_rating",  "WA":  "wa_rating",  "TAS": "tas_rating",
    "NT":  "nt_rating",  "ACT": "act_rating",
    "Skill level ":  "skill_level",
    "Major Occupation Group": "major_occupation_group",
}

VET_OUTCOMES_RENAME = {
    "Program ID":                                 "program_id",
    "Program name":                               "program_name",
    "Field of education":                         "field_of_education",
    "Qualification level":                        "qualification_level",
    "Number of respondents":                      "n_respondents",
    "Employed or in further study":               "pct_employed_or_study",
    " Improved employment status after training": "pct_improved_employment",
    "Commenced further study after training":     "pct_commenced_further_study",
    "Satisfied with the training":                "pct_satisfied",
    "Median annual income ($)":                   "median_annual_income",
}

VNDA_RENAME = {
    "Cohort group":             "cohort_group",
    "Cohort":                   "cohort",
    "Pct_Total":                "pct_total",
    "Pct Employed Rate Prior":  "pct_employed_prior",
    "Pct Employed Rate Post":   "pct_employed_post",
    "PctPt Change in Employment": "pptchange_employment",
    "Pct Employed FT prior":    "pct_employed_ft_prior",
    "Pct Employed FT post":     "pct_employed_ft_post",
    "Pct Employed PT prior":    "pct_employed_pt_prior",
    "Pct Employed PT post":     "pct_employed_pt_post",
    "Median Income":            "median_income",
    "Median Income Change":     "median_income_change",
    "Median Income Total":      "median_income_total",
    "Median Income Total Change": "median_income_total_change",
}

APPRENTICES_RENAME = {
    "State":               "state",
    "contract":            "contract_type",
    "collection_quarter":  "collection_quarter",
    "collection_number":   "collection_number",
    "review_quarter":      "review_quarter_date",
    "Estimate":            "estimate",
    "model":               "model_estimate",
    "type":                "estimate_type",
    "Low95":               "ci_lower_95",
    "High95":              "ci_upper_95",
    "final_count":         "final_count",
    "perc_of_final_count": "pct_of_final_count",
    "count_in_PI":         "final_count_in_pi",
    "raw_value":           "raw_collected_count",
    "model_perc_final_count": "model_pct_of_final_count",
}

ANZSCO_TITLE_TYPE_MAP = {
    "P": "principal",
    "A": "alternative",
    "S": "specialisation",
    "N": "nec_category",
}

# ── Shortage rating standardisation map ─────────────────────────────────────
# Applied to all shortage rating columns across all datasets.
# Keys are raw values found in the data; values are the canonical form.
SHORTAGE_RATING_MAP = {
    "S":               "Shortage",
    "shortage":        "Shortage",
    "Shortage":        "Shortage",
    "M":               "Metro Shortage",
    "Metro shortage":  "Metro Shortage",
    "metro shortage":  "Metro Shortage",
    "R":               "Regional Shortage",
    "Regional shortage": "Regional Shortage",
    "regional shortage": "Regional Shortage",
    "NS":              "No Shortage",
    "No shortage":     "No Shortage",
    "no shortage":     "No Shortage",
    "No Shortage":     "No Shortage",
}

# Canonical ordered category for shortage ratings
SHORTAGE_RATING_ORDER = ["Shortage", "Metro Shortage", "Regional Shortage", "No Shortage"]

# ── ANZSCO major group label → code map ─────────────────────────────────────
# Used to add a major_group_code column where only labels exist.
ANZSCO_MAJOR_GROUP_MAP = {
    "Managers":                               1,
    "Professionals":                          2,
    "Technicians and Trades Workers":         3,
    "Community and Personal Service Workers": 4,
    "Clerical and Administrative Workers":    5,
    "Sales Workers":                          6,
    "Machinery Operators and Drivers":        7,
    "Labourers":                              8,
}

ANZSCO_MAJOR_GROUP_LABELS = {
    code: label for label, code in ANZSCO_MAJOR_GROUP_MAP.items()
}

# ── Validation rules ─────────────────────────────────────────────────────────
# Each dataset's validation schema: column → (dtype, nullable, min, max, allowed_values)
# None means "no constraint on that axis"
VALIDATION_RULES = {
    "osl_filtered": {
        "anzsco_code":             ("int64",   False, 100000, 999999, None),
        "skill_level":             ("int64",   True,  1,      5,      None),
        "national_shortage_rating":("category",False, None,   None,   SHORTAGE_RATING_ORDER),
        "victoria_shortage_rating":("category",False, None,   None,   SHORTAGE_RATING_ORDER),
    },
    "osl_full": {
        "anzsco_code":             ("int64",  False, 100000, 999999, None),
        "skill_level":             ("float64",True,  1,      5,      None),
        "national_shortage_rating":("category",False,None,   None,   SHORTAGE_RATING_ORDER),
    },
    "anzsco_reference": {
        "anzsco_code":             ("int64",  False, 100000, 999999, None),
        "major_group_code":        ("int64",  False, 1,      8,      None),
        "title_type":              ("object", False, None,   None,   ["principal", "alternative", "specialisation", "nec_category"]),
    },
    "vet_outcomes": {
        "n_respondents":           ("float64", True, 100,    None,  None),
        "pct_employed_or_study":   ("float64", True, 0,      100,   None),
        "pct_satisfied":           ("float64", True, 0,      100,   None),
    },
    "vnda": {
        "pct_employed_prior":      ("float64", True, 0,      100,   None),
        "pct_employed_post":       ("float64", True, 0,      100,   None),
        "pct_employed_tot_prior":  ("float64", True, 0,      100,   None),
        "pct_employed_tot_post":   ("float64", True, 0,      100,   None),
        "pct_employed_ft_prior":   ("float64", True, 0,      100,   None),
        "pct_employed_ft_post":    ("float64", True, 0,      100,   None),
        "pct_employed_pt_prior":   ("float64", True, 0,      100,   None),
        "pct_employed_pt_post":    ("float64", True, 0,      100,   None),
        "median_income":           ("float64", True, 0,      None,  None),
        "median_income_total":     ("float64", True, 0,      None,  None),
        "total_ft_median_income":  ("float64", True, 0,      None,  None),
        "course_rank":             ("float64", True, 1,      None,  None),
        "count_of_unique_occupations": ("float64", True, 0,  None,  None),
    },
    "apprentices": {
        "pct_of_final_count":      ("float64", True, 50,     200,   None),
        "final_count_in_pi":       ("object",  True, None,   None,  ["Y", "N"]),
    },
}

# ── Profiling settings ───────────────────────────────────────────────────────
PROFILE_SETTINGS = {
    "minimal":  True,   # use minimal mode for speed on large datasets
    "samples":  5,      # number of sample rows in the report
    "correlations": {"auto": {"calculate": True}},
}

# ── Fuzzy match threshold ────────────────────────────────────────────────────
# When matching occupation title strings to the ANZSCO lookup, require at
# least this similarity score (0-100) to accept the match.
FUZZY_MATCH_THRESHOLD = 95
