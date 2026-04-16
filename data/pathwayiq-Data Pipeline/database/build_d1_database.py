from __future__ import annotations

import csv
import re
import sqlite3
import subprocess
from collections import defaultdict
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CLEANED_DIR = ROOT.parent / "cleaned_data"
FRONTEND_DIR = ROOT.parent / "frontend_exports"
BUILD_DIR = ROOT / "build"
SCHEMA_PATH = ROOT / "schema.sql"
DB_PATH = BUILD_DIR / "pathwayiq.sqlite"
D1_SQL_PATH = BUILD_DIR / "pathwayiq_d1_import.sql"
LOADER_VERSION = "2026.04.16"

DATASET_META = {
    "anzsco_reference": {
        "file": "clean_anzsco_reference.csv",
        "name": "ANZSCO reference titles",
        "source_organisation": "ABS / ANZSCO",
        "source_grain": "occupation title alias",
        "description": "Authoritative ANZSCO title registry used as the reference dimension.",
    },
    "osl_filtered": {
        "file": "clean_osl_filtered.csv",
        "name": "Occupation shortage list (filtered)",
        "source_organisation": "Jobs and Skills Australia",
        "source_grain": "occupation",
        "description": "Canonical shortage snapshot used for frontend occupation summaries.",
    },
    "osl_full": {
        "file": "clean_osl_full.csv",
        "name": "Occupation shortage list (full)",
        "source_organisation": "Jobs and Skills Australia",
        "source_grain": "occupation by state",
        "description": "State-level shortage ratings per occupation.",
    },
    "osd": {
        "file": "clean_osd.csv",
        "name": "Occupation shortage drivers",
        "source_organisation": "Jobs and Skills Australia",
        "source_grain": "ANZSCO unit group",
        "description": "Unit-group shortage drivers and labour market indicators.",
    },
    "vet_outcomes": {
        "file": "clean_vet_outcomes.csv",
        "name": "VET outcomes",
        "source_organisation": "NCVER",
        "source_grain": "program",
        "description": "Program-level VET outcomes and income metrics.",
    },
    "vet_outcomes_occ_long": {
        "file": "clean_vet_outcomes_occ_long.csv",
        "name": "VET outcomes top occupations",
        "source_organisation": "NCVER",
        "source_grain": "program by occupation rank",
        "description": "Top occupation outcomes by program.",
    },
    "vet_outcomes_ind_long": {
        "file": "clean_vet_outcomes_ind_long.csv",
        "name": "VET outcomes top industries",
        "source_organisation": "NCVER",
        "source_grain": "program by industry rank",
        "description": "Top industry outcomes by program.",
    },
    "vnda_course_metrics": {
        "file": "clean_vnda_course_metrics.csv",
        "name": "VNDA course metrics",
        "source_organisation": "Department of Employment and Workplace Relations",
        "source_grain": "course",
        "description": "Course-level graduate metrics.",
    },
    "vnda_course_occupations": {
        "file": "clean_vnda_course_occupations.csv",
        "name": "VNDA course occupations",
        "source_organisation": "Department of Employment and Workplace Relations",
        "source_grain": "course by occupation",
        "description": "Program-to-occupation bridge with ANZSCO matching.",
    },
    "vnda_national": {
        "file": "clean_vnda_national.csv",
        "name": "VNDA national cohort summary",
        "source_organisation": "Department of Employment and Workplace Relations",
        "source_grain": "national cohort",
        "description": "National graduate outcome summaries.",
    },
    "vnda_state": {
        "file": "clean_vnda_state.csv",
        "name": "VNDA state summary",
        "source_organisation": "Department of Employment and Workplace Relations",
        "source_grain": "state",
        "description": "State graduate outcome summaries.",
    },
    "vnda_aqf": {
        "file": "clean_vnda_aqf.csv",
        "name": "VNDA AQF summary",
        "source_organisation": "Department of Employment and Workplace Relations",
        "source_grain": "jurisdiction by AQF",
        "description": "AQF-level graduate outcome summaries.",
    },
    "vnda_aqf_foe_national": {
        "file": "clean_vnda_aqf_foe_national.csv",
        "name": "VNDA AQF FOE national summary",
        "source_organisation": "Department of Employment and Workplace Relations",
        "source_grain": "AQF and field of education",
        "description": "National AQF × FOE summaries.",
    },
    "vnda_aqf_foe_state": {
        "file": "clean_vnda_aqf_foe_state.csv",
        "name": "VNDA AQF FOE state summary",
        "source_organisation": "Department of Employment and Workplace Relations",
        "source_grain": "state by AQF and field of education",
        "description": "State AQF × FOE summaries.",
    },
    "seuv": {
        "file": "clean_seuv.csv",
        "name": "Survey of Employers' Use and Views",
        "source_organisation": "NCVER",
        "source_grain": "survey metric observation",
        "description": "Employer survey observations normalised by table, metric, and year.",
    },
    "apprentices": {
        "file": "clean_apprentices.csv",
        "name": "Apprentices and trainees",
        "source_organisation": "NCVER",
        "source_grain": "state by contract type and quarter",
        "description": "Apprenticeship estimate snapshots by state and contract type.",
    },
}

REQUIRED_FIELDS = {
    "anzsco_reference": ["anzsco_code", "occupation_title", "major_group_code"],
    "osl_filtered": ["anzsco_code", "occupation_title", "national_shortage_rating", "victoria_shortage_rating"],
    "osl_full": ["anzsco_code", "occupation_title", "national_shortage_rating"],
    "osd": ["unit_group", "source_table"],
    "vet_outcomes": ["program_id", "program_name", "qualification_level", "field_of_education"],
    "vet_outcomes_occ_long": ["program_id", "occupation_label", "rank"],
    "vet_outcomes_ind_long": ["program_id", "industry_label", "rank"],
    "vnda_course_metrics": ["course_id", "course_name", "aqf_level", "foe"],
    "vnda_course_occupations": ["course_id", "course_name", "occupation_name", "source_sheet"],
    "vnda_national": ["cohort_group", "cohort"],
    "vnda_state": ["state"],
    "vnda_aqf": ["jurisdiction", "aqf_level"],
    "vnda_aqf_foe_national": ["aqf_foe", "aqf_level", "foe"],
    "vnda_aqf_foe_state": ["state", "aqf_level", "foe"],
    "seuv": ["table_id", "metric_label", "measure_label", "survey_year", "slice_dataset"],
    "apprentices": ["state", "contract_type", "collection_quarter", "estimate_type"],
}

BUSINESS_KEYS = {
    "anzsco_reference": ["anzsco_code", "normalised_title", "title_type_code", "jurisdiction_scope"],
    "osl_filtered": ["anzsco_code"],
    "osl_full": ["anzsco_code"],
    "osd": ["unit_group", "source_table", "source_id"],
    "vet_outcomes": ["program_id"],
    "vet_outcomes_occ_long": ["program_id", "rank", "occupation_label"],
    "vet_outcomes_ind_long": ["program_id", "rank", "industry_label"],
    "vnda_course_metrics": ["course_id"],
    "vnda_course_occupations": ["course_id", "course_occupation_rank", "occupation_name"],
    "vnda_national": ["cohort_group", "cohort"],
    "vnda_state": ["state"],
    "vnda_aqf": ["jurisdiction", "aqf_level"],
    "vnda_aqf_foe_national": ["aqf_foe"],
    "vnda_aqf_foe_state": ["state", "aqf_foe"],
    "seuv": ["table_id", "slice_section", "metric_label", "measure_label", "survey_year"],
    "apprentices": ["state", "contract_type", "collection_quarter", "estimate_type"],
}

MAJOR_GROUPS = {
    1: "Managers",
    2: "Professionals",
    3: "Technicians and Trades Workers",
    4: "Community and Personal Service Workers",
    5: "Clerical and Administrative Workers",
    6: "Sales Workers",
    7: "Machinery Operators and Drivers",
    8: "Labourers",
}

SHORTAGE_RATINGS = [
    ("Shortage", 1),
    ("Metro Shortage", 2),
    ("Regional Shortage", 3),
    ("No Shortage", 4),
]

STATE_NAME_TO_CODE = {
    "New South Wales": "NSW",
    "Victoria": "VIC",
    "Queensland": "QLD",
    "South Australia": "SA",
    "Western Australia": "WA",
    "Tasmania": "TAS",
    "Northern Territory": "NT",
    "Australian Capital Territory": "ACT",
    "Australia": "AUS",
    "National": "AUS",
    "Nsw": "NSW",
    "Vic": "VIC",
    "Qld": "QLD",
    "Sa": "SA",
    "Wa": "WA",
    "Tas": "TAS",
    "Nt": "NT",
    "Act": "ACT",
}

STATE_CODE_TO_NAME = {value: key for key, value in STATE_NAME_TO_CODE.items()}

SURVEY_DATASETS = ["overall", "state_territory", "industry", "employer_size", "training_type"]
CONTRACT_TYPES = ["Commencements", "Completions", "In-Training", "Cancellations/Withdrawals"]
ESTIMATE_TYPES = ["Initial", "1st Revision"]


def clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def normalize_text(value: str | None) -> str | None:
    value = clean(value)
    if value is None:
        return None
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def to_int(value: str | None) -> int | None:
    value = clean(value)
    if value is None:
        return None
    return int(float(value))


def to_float(value: str | None) -> float | None:
    value = clean(value)
    if value is None:
        return None
    return float(value)


def to_bool_int(value: str | None) -> int | None:
    value = clean(value)
    if value is None:
        return None
    low = value.lower()
    if low in {"true", "1", "yes", "y"}:
        return 1
    if low in {"false", "0", "no", "n"}:
        return 0
    raise ValueError(f"Unexpected boolean value: {value}")


def read_csv_rows(path: Path) -> list[dict[str, str | None]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return [{key: clean(value) for key, value in row.items()} for row in reader]


def completeness_ratio(rows: list[dict[str, str | None]], required_fields: list[str]) -> tuple[float, float, float]:
    denominator = float(len(rows) * len(required_fields))
    if denominator == 0:
        return 0.0, 0.0, 1.0
    numerator = 0.0
    for row in rows:
        for field in required_fields:
            if clean(row.get(field)):
                numerator += 1.0
    return numerator, denominator, numerator / denominator


def uniqueness_ratio(rows: list[dict[str, str | None]], key_fields: list[str]) -> tuple[float, float, float]:
    denominator = float(len(rows))
    if denominator == 0:
        return 0.0, 0.0, 1.0
    keys = set()
    for row in rows:
        key = tuple(clean(row.get(field)) or "" for field in key_fields)
        keys.add(key)
    numerator = float(len(keys))
    return numerator, denominator, numerator / denominator


def summary_key(scope: str, **parts: str | None) -> str:
    ordered = [f"{key}={parts[key]}" for key in sorted(parts) if clean(parts[key])]
    return f"{scope}|" + "|".join(ordered)


def now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


def state_to_code(value: str | None) -> str | None:
    value = clean(value)
    if value is None:
        return None
    return STATE_NAME_TO_CODE.get(value, value.upper() if len(value) <= 3 else value)


def write_csv(path: Path, columns: list[str], rows: list[tuple]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(columns)
        writer.writerows(rows)


def main() -> None:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    FRONTEND_DIR.mkdir(parents=True, exist_ok=True)

    raw_data: dict[str, list[dict[str, str | None]]] = {}
    for dataset_code, meta in DATASET_META.items():
        raw_data[dataset_code] = read_csv_rows(CLEANED_DIR / meta["file"])

    issues: list[dict[str, str | None]] = []
    load_stats: dict[str, dict[str, int]] = {
        code: {"loaded_rows": 0, "skipped_rows": 0} for code in DATASET_META
    }

    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    cursor = conn.cursor()

    run_id = f"run-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    started_at = now_iso()
    cursor.execute(
        """
        INSERT INTO ingestion_run (run_id, loader_version, started_at, notes)
        VALUES (?, ?, ?, ?)
        """,
        (run_id, LOADER_VERSION, started_at, "Local SQLite build for Cloudflare D1 import and frontend CSV export."),
    )

    cursor.executemany(
        """
        INSERT INTO dataset_catalog (
          dataset_code, dataset_name, source_organisation, source_grain, source_file_name, description
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            (
                code,
                meta["name"],
                meta["source_organisation"],
                meta["source_grain"],
                meta["file"],
                meta["description"],
            )
            for code, meta in DATASET_META.items()
        ],
    )

    cursor.executemany(
        "INSERT INTO major_group (major_group_code, major_group_label) VALUES (?, ?)",
        list(MAJOR_GROUPS.items()),
    )
    cursor.executemany(
        "INSERT INTO shortage_rating (shortage_rating, display_order) VALUES (?, ?)",
        SHORTAGE_RATINGS,
    )
    cursor.executemany(
        "INSERT INTO state_dim (state_code, state_name) VALUES (?, ?)",
        sorted(STATE_CODE_TO_NAME.items()),
    )
    cursor.executemany(
        "INSERT INTO survey_dataset_dim (slice_dataset) VALUES (?)",
        [(value,) for value in SURVEY_DATASETS],
    )
    cursor.executemany(
        "INSERT INTO contract_type_dim (contract_type) VALUES (?)",
        [(value,) for value in CONTRACT_TYPES],
    )
    cursor.executemany(
        "INSERT INTO estimate_type_dim (estimate_type) VALUES (?)",
        [(value,) for value in ESTIMATE_TYPES],
    )

    aqf_levels = set()
    fields_of_education = set()
    for row in raw_data["vet_outcomes"]:
        if row["qualification_level"]:
            aqf_levels.add(row["qualification_level"])
        if row["field_of_education"]:
            fields_of_education.add(row["field_of_education"])
    for row in raw_data["vnda_course_metrics"]:
        if row["aqf_level"]:
            aqf_levels.add(row["aqf_level"])
        if row["foe"]:
            fields_of_education.add(row["foe"])
    for dataset_code in ("vnda_aqf_foe_national", "vnda_aqf_foe_state"):
        for row in raw_data[dataset_code]:
            if row["aqf_level"]:
                aqf_levels.add(row["aqf_level"])
            if row["foe"]:
                fields_of_education.add(row["foe"])

    cursor.executemany(
        "INSERT INTO aqf_level_dim (aqf_level) VALUES (?)",
        [(value,) for value in sorted(aqf_levels)],
    )
    cursor.executemany(
        "INSERT INTO field_of_education_dim (field_of_education) VALUES (?)",
        [(value,) for value in sorted(fields_of_education)],
    )

    occupations: dict[str, dict[str, str | int | None]] = {}
    alias_rows: list[tuple] = []
    alias_match_lookup: set[tuple[str, str]] = set()

    for row in raw_data["anzsco_reference"]:
        code = row["anzsco_code"]
        if not code:
            load_stats["anzsco_reference"]["skipped_rows"] += 1
            continue
        preferred = to_bool_int(row["is_preferred_title"]) or 0
        if code not in occupations:
            occupations[code] = {
                "preferred_title": row["preferred_occupation_title"] or row["occupation_title"],
                "normalised_preferred_title": normalize_text(row["preferred_occupation_title"] or row["occupation_title"]),
                "major_group_code": to_int(row["major_group_code"]),
                "sub_major_group_code": row["sub_major_group_code"],
                "minor_group_code": row["minor_group_code"],
                "unit_group_code": row["unit_group_code"],
                "preferred_title_type": row["preferred_title_type"] or row["title_type"],
                "preferred_jurisdiction_scope": row["preferred_jurisdiction_scope"] or row["jurisdiction_scope"],
                "default_skill_level": None,
                "created_from_reference": 1,
            }
        if preferred == 1:
            occupations[code]["preferred_title"] = row["occupation_title"] or row["preferred_occupation_title"]
            occupations[code]["normalised_preferred_title"] = normalize_text(
                row["occupation_title"] or row["preferred_occupation_title"]
            )
            occupations[code]["preferred_title_type"] = row["title_type"]
            occupations[code]["preferred_jurisdiction_scope"] = row["jurisdiction_scope"]

        alias_rows.append(
            (
                code,
                row["raw_title"] or row["occupation_title"],
                normalize_text(row["raw_title"] or row["occupation_title"]),
                row["title_type_code"],
                row["title_type"],
                row["jurisdiction_scope"] or "Generic",
                preferred,
            )
        )
        alias_match_lookup.add((code, normalize_text(row["occupation_title"])))
        load_stats["anzsco_reference"]["loaded_rows"] += 1

    for dataset_code in ("osl_filtered", "osl_full"):
        for row in raw_data[dataset_code]:
            code = row["anzsco_code"]
            if not code:
                continue
            if dataset_code == "osl_full" and row.get("classification_system") not in (None, "ANZSCO_2022"):
                continue
            occ = occupations.setdefault(
                code,
                {
                    "preferred_title": row["occupation_title"],
                    "normalised_preferred_title": normalize_text(row["occupation_title"]),
                    "major_group_code": to_int(row.get("major_group_code")),
                    "sub_major_group_code": None,
                    "minor_group_code": None,
                    "unit_group_code": None,
                    "preferred_title_type": "derived",
                    "preferred_jurisdiction_scope": "Generic",
                    "default_skill_level": None,
                    "created_from_reference": 0,
                },
            )
            if occ["default_skill_level"] is None and row.get("skill_level"):
                occ["default_skill_level"] = to_int(row["skill_level"])
            if occ["major_group_code"] is None and row.get("major_group_code"):
                occ["major_group_code"] = to_int(row["major_group_code"])

    cursor.executemany(
        """
        INSERT INTO occupation (
          anzsco_code, preferred_title, normalised_preferred_title, major_group_code,
          sub_major_group_code, minor_group_code, unit_group_code,
          preferred_title_type, preferred_jurisdiction_scope, default_skill_level, created_from_reference
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                code,
                values["preferred_title"],
                values["normalised_preferred_title"],
                values["major_group_code"],
                values["sub_major_group_code"],
                values["minor_group_code"],
                values["unit_group_code"],
                values["preferred_title_type"],
                values["preferred_jurisdiction_scope"],
                values["default_skill_level"],
                values["created_from_reference"],
            )
            for code, values in sorted(occupations.items())
        ],
    )

    cursor.executemany(
        """
        INSERT OR IGNORE INTO occupation_title_alias (
          anzsco_code, raw_title, normalised_title, title_type_code,
          title_type, jurisdiction_scope, is_preferred_title
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        alias_rows,
    )

    for dataset_code in ("osl_filtered", "osl_full"):
        snapshot_rows = []
        for row in raw_data[dataset_code]:
            code = row["anzsco_code"]
            if not code:
                load_stats[dataset_code]["skipped_rows"] += 1
                continue
            if dataset_code == "osl_full" and row.get("classification_system") not in (None, "ANZSCO_2022"):
                load_stats[dataset_code]["skipped_rows"] += 1
                issues.append(
                    {
                        "dataset_code": dataset_code,
                        "entity_name": "occupation_shortage_snapshot",
                        "issue_type": "non_canonical_classification",
                        "severity": "info",
                        "record_key": code,
                        "message": f"Skipped OSL full row with classification_system={row.get('classification_system')} to preserve ANZSCO-key consistency.",
                    }
                )
                continue
            title = row["occupation_title"]
            if dataset_code == "osl_filtered":
                vic_rating = row["victoria_shortage_rating"]
            else:
                vic_rating = row["vic_rating"]
            snapshot_rows.append(
                (
                    dataset_code,
                    code,
                    title,
                    row["national_shortage_rating"],
                    vic_rating,
                    to_int(row.get("skill_level")),
                    to_int(row.get("major_group_code")),
                )
            )
            load_stats[dataset_code]["loaded_rows"] += 1
        cursor.executemany(
            """
            INSERT INTO occupation_shortage_snapshot (
              dataset_code, anzsco_code, occupation_title,
              national_shortage_rating, victoria_shortage_rating, skill_level, major_group_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            snapshot_rows,
        )

    state_rating_rows = []
    rating_columns = {
        "NSW": "nsw_rating",
        "VIC": "vic_rating",
        "QLD": "qld_rating",
        "SA": "sa_rating",
        "WA": "wa_rating",
        "TAS": "tas_rating",
        "NT": "nt_rating",
        "ACT": "act_rating",
    }
    for row in raw_data["osl_full"]:
        code = row["anzsco_code"]
        if not code:
            continue
        if row.get("classification_system") not in (None, "ANZSCO_2022"):
            continue
        for state_code, column_name in rating_columns.items():
            if row.get(column_name):
                state_rating_rows.append(("osl_full", code, state_code, row[column_name]))
    cursor.executemany(
        """
        INSERT INTO occupation_shortage_state_rating (
          dataset_code, anzsco_code, state_code, shortage_rating
        ) VALUES (?, ?, ?, ?)
        """,
        state_rating_rows,
    )

    unit_groups = sorted({row["unit_group"] for row in raw_data["osd"] if row["unit_group"]})
    cursor.executemany("INSERT INTO unit_group (unit_group_name) VALUES (?)", [(value,) for value in unit_groups])
    osd_rows = []
    for row in raw_data["osd"]:
        if not row["unit_group"]:
            load_stats["osd"]["skipped_rows"] += 1
            continue
        osd_rows.append(
            (
                "osd",
                row["unit_group"],
                row["driver_2024"],
                row["driver_2025"],
                row["source_table"],
                row["source_tables"],
                to_int(row.get("source_table_count")),
                row["source_type"],
                row["source_id"],
                to_float(row.get("ivi_ue_ratio")),
                to_float(row.get("employment_growth_5yr")),
                to_bool_int(row.get("in_shortage_2025_flag")) or 0,
                to_bool_int(row.get("new_shortage_2025_flag")) or 0,
                to_bool_int(row.get("no_longer_shortage_2025_flag")) or 0,
                to_bool_int(row.get("driver_2024_source_mismatch_flag")) or 0,
                to_bool_int(row.get("driver_2025_source_mismatch_flag")) or 0,
                to_bool_int(row.get("source_status_conflict_flag")) or 0,
                row["shortage_driver"],
                row["driver_conflict"],
                to_bool_int(row.get("ivi_ue_ratio_negative_flag")) or 0,
                to_bool_int(row.get("employment_growth_extreme_flag")) or 0,
                row["anzsco_join_note"],
            )
        )
        load_stats["osd"]["loaded_rows"] += 1
    cursor.executemany(
        """
        INSERT INTO occupation_shortage_driver (
          dataset_code, unit_group_name, driver_2024, driver_2025, source_table, source_tables,
          source_table_count, source_type, source_id, ivi_ue_ratio, employment_growth_5yr,
          in_shortage_2025_flag, new_shortage_2025_flag, no_longer_shortage_2025_flag,
          driver_2024_source_mismatch_flag, driver_2025_source_mismatch_flag,
          source_status_conflict_flag, shortage_driver, driver_conflict,
          ivi_ue_ratio_negative_flag, employment_growth_extreme_flag, anzsco_join_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        osd_rows,
    )

    programs: dict[str, dict[str, str | int | None]] = {}

    def merge_program(program_id: str | None, name: str | None, aqf_level: str | None, field: str | None, source: str) -> None:
        if not program_id:
            return
        record = programs.setdefault(
            program_id,
            {
                "program_name": None,
                "aqf_level": None,
                "field_of_education": None,
                "has_vet_outcomes": 0,
                "has_vnda_metrics": 0,
            },
        )
        if source == "vet_outcomes":
            record["has_vet_outcomes"] = 1
        if source.startswith("vnda"):
            record["has_vnda_metrics"] = 1

        for field_name, incoming in (
            ("program_name", name),
            ("aqf_level", aqf_level),
            ("field_of_education", field),
        ):
            incoming = clean(incoming)
            existing = record[field_name]
            if incoming and not existing:
                record[field_name] = incoming
            elif incoming and existing and incoming != existing:
                if field_name == "program_name" and len(incoming) > len(existing):
                    record[field_name] = incoming
                issues.append(
                    {
                        "dataset_code": source,
                        "entity_name": "program",
                        "issue_type": "source_conflict",
                        "severity": "warning",
                        "record_key": program_id,
                        "message": f"Conflicting {field_name}: kept '{record[field_name]}' and also saw '{incoming}'.",
                    }
                )

    for row in raw_data["vet_outcomes"]:
        merge_program(row["program_id"], row["program_name"], row["qualification_level"], row["field_of_education"], "vet_outcomes")
    for row in raw_data["vnda_course_metrics"]:
        merge_program(row["course_id"], row["course_name"], row["aqf_level"], row["foe"], "vnda_course_metrics")

    cursor.executemany(
        """
        INSERT INTO program (
          program_id, program_name, aqf_level, field_of_education, has_vet_outcomes, has_vnda_metrics
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            (
                program_id,
                values["program_name"] or program_id,
                values["aqf_level"],
                values["field_of_education"],
                values["has_vet_outcomes"],
                values["has_vnda_metrics"],
            )
            for program_id, values in sorted(programs.items())
        ],
    )

    vet_outcome_rows = []
    for row in raw_data["vet_outcomes"]:
        if not row["program_id"]:
            load_stats["vet_outcomes"]["skipped_rows"] += 1
            continue
        vet_outcome_rows.append(
            (
                "vet_outcomes",
                row["program_id"],
                to_int(row.get("n_respondents")),
                to_float(row.get("pct_employed_or_study")),
                to_float(row.get("pct_improved_employment")),
                to_float(row.get("pct_commenced_further_study")),
                to_float(row.get("pct_satisfied")),
                to_float(row.get("median_annual_income")),
                to_float(row.get("median_annual_income_original")),
                to_bool_int(row.get("median_annual_income_imputed_flag")) or 0,
                row["median_annual_income_value_source"],
                row["median_annual_income_imputation_basis"],
                to_bool_int(row.get("median_annual_income_structural_missing_flag")) or 0,
                to_float(row.get("median_annual_income_model_prediction")),
                to_bool_int(row.get("median_annual_income_prediction_clipped_flag")) or 0,
                row["industry_profile_note"],
                to_bool_int(row.get("occupation_pct_normalized_flag")) or 0,
                to_float(row.get("occupation_top3_pct_total")),
                to_float(row.get("occupation_other_pct")),
                to_bool_int(row.get("industry_pct_normalized_flag")) or 0,
                to_float(row.get("industry_top3_pct_total")),
                to_bool_int(row.get("median_annual_income_outlier_flag")) or 0,
            )
        )
        load_stats["vet_outcomes"]["loaded_rows"] += 1
    cursor.executemany(
        """
        INSERT INTO program_vet_outcome (
          dataset_code, program_id, n_respondents, pct_employed_or_study, pct_improved_employment,
          pct_commenced_further_study, pct_satisfied, median_annual_income, median_annual_income_original,
          median_annual_income_imputed_flag, median_annual_income_value_source,
          median_annual_income_imputation_basis, median_annual_income_structural_missing_flag,
          median_annual_income_model_prediction, median_annual_income_prediction_clipped_flag,
          industry_profile_note, occupation_pct_normalized_flag, occupation_top3_pct_total,
          occupation_other_pct, industry_pct_normalized_flag, industry_top3_pct_total,
          median_annual_income_outlier_flag
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        vet_outcome_rows,
    )

    def valid_rank_row(label: str | None, rank: str | None, prefix: str) -> tuple[bool, int | None]:
        if not label or label.lower() in {"false", "true"}:
            return False, None
        match = re.fullmatch(rf"{prefix}_top([1-3])", rank or "")
        if not match:
            return False, None
        return True, int(match.group(1))

    vet_occ_rows = []
    for row in raw_data["vet_outcomes_occ_long"]:
        valid, rank_no = valid_rank_row(row["occupation_label"], row["rank"], "occ")
        if not valid or not row["program_id"]:
            load_stats["vet_outcomes_occ_long"]["skipped_rows"] += 1
            continue
        vet_occ_rows.append(
            (
                "vet_outcomes",
                row["program_id"],
                rank_no,
                row["occupation_label"],
                to_float(row.get("pct_employed_in_occ")),
                to_int(row.get("anzsco_major_group_code")),
                row["anzsco_major_group_label"],
            )
        )
        load_stats["vet_outcomes_occ_long"]["loaded_rows"] += 1
    cursor.executemany(
        """
        INSERT INTO program_vet_top_occupation (
          dataset_code, program_id, rank_no, occupation_label,
          pct_employed_in_occ, anzsco_major_group_code, anzsco_major_group_label
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        vet_occ_rows,
    )

    vet_ind_rows = []
    for row in raw_data["vet_outcomes_ind_long"]:
        valid, rank_no = valid_rank_row(row["industry_label"], row["rank"], "ind")
        if not valid or not row["program_id"]:
            load_stats["vet_outcomes_ind_long"]["skipped_rows"] += 1
            continue
        vet_ind_rows.append(
            (
                "vet_outcomes",
                row["program_id"],
                rank_no,
                row["industry_label"],
                to_float(row.get("pct_employed_in_industry")),
            )
        )
        load_stats["vet_outcomes_ind_long"]["loaded_rows"] += 1
    cursor.executemany(
        """
        INSERT INTO program_vet_top_industry (
          dataset_code, program_id, rank_no, industry_label, pct_employed_in_industry
        ) VALUES (?, ?, ?, ?, ?)
        """,
        vet_ind_rows,
    )

    graduate_metric_rows = []
    for row in raw_data["vnda_course_metrics"]:
        if not row["course_id"]:
            load_stats["vnda_course_metrics"]["skipped_rows"] += 1
            continue
        graduate_metric_rows.append(
            (
                "vnda_course_metrics",
                row["course_id"],
                to_int(row.get("course_rank")),
                to_bool_int(row.get("small_count_flag")) or 0,
                to_float(row.get("pct_employed_prior")),
                to_float(row.get("pct_employed_post")),
                to_float(row.get("pptchange_employment")),
                to_float(row.get("pct_employed_tot_prior")),
                to_float(row.get("pct_employed_tot_post")),
                to_float(row.get("pctpt_change_in_tot_employment")),
                to_float(row.get("pct_employed_pt_prior")),
                to_float(row.get("pct_employed_pt_post")),
                to_float(row.get("pctpt_change_in_pt_employment")),
                to_float(row.get("pct_employed_ft_prior")),
                to_float(row.get("pct_employed_ft_post")),
                to_float(row.get("pctpt_change_in_ft_employment")),
                to_float(row.get("median_income")),
                to_float(row.get("median_income_change")),
                to_float(row.get("median_income_total")),
                to_float(row.get("median_income_total_change")),
                to_float(row.get("total_ft_median_income")),
                to_float(row.get("total_ft_median_income_change")),
                to_float(row.get("income_support_exit_rate")),
                to_float(row.get("pct_higher_vet_progression")),
                to_float(row.get("pct_any_vet_progression")),
                to_float(row.get("pct_female")),
                to_float(row.get("pct_disability")),
                to_float(row.get("pct_apprentice_trainees")),
                to_float(row.get("pct_first_nations")),
                to_float(row.get("pct_no_yr12_no_cert_iii")),
                to_float(row.get("pct_government_funded")),
                to_float(row.get("median_completion_age_yrs")),
                to_float(row.get("median_completion_time_days")),
                to_float(row.get("pct_remote")),
                to_float(row.get("pct_regional")),
                to_float(row.get("pct_major_city")),
                to_int(row.get("count_of_unique_occupations")),
                row["source_sheet"],
                to_int(row.get("suppressed_value_count")) or 0,
                to_bool_int(row.get("has_suppressed_values")) or 0,
                to_bool_int(row.get("median_income_outlier_flag")) or 0,
                to_bool_int(row.get("median_income_change_outlier_flag")) or 0,
                to_bool_int(row.get("median_income_total_outlier_flag")) or 0,
                to_bool_int(row.get("median_income_total_change_outlier_flag")) or 0,
                to_bool_int(row.get("total_ft_median_income_outlier_flag")) or 0,
                to_bool_int(row.get("total_ft_median_income_change_outlier_flag")) or 0,
            )
        )
        load_stats["vnda_course_metrics"]["loaded_rows"] += 1
    cursor.executemany(
        """
        INSERT INTO program_graduate_metric (
          dataset_code, program_id, course_rank, small_count_flag, pct_employed_prior,
          pct_employed_post, pptchange_employment, pct_employed_tot_prior, pct_employed_tot_post,
          pctpt_change_in_tot_employment, pct_employed_pt_prior, pct_employed_pt_post,
          pctpt_change_in_pt_employment, pct_employed_ft_prior, pct_employed_ft_post,
          pctpt_change_in_ft_employment, median_income, median_income_change, median_income_total,
          median_income_total_change, total_ft_median_income, total_ft_median_income_change,
          income_support_exit_rate, pct_higher_vet_progression, pct_any_vet_progression,
          pct_female, pct_disability, pct_apprentice_trainees, pct_first_nations,
          pct_no_yr12_no_cert_iii, pct_government_funded, median_completion_age_yrs,
          median_completion_time_days, pct_remote, pct_regional, pct_major_city,
          count_of_unique_occupations, source_sheet, suppressed_value_count, has_suppressed_values,
          median_income_outlier_flag, median_income_change_outlier_flag,
          median_income_total_outlier_flag, median_income_total_change_outlier_flag,
          total_ft_median_income_outlier_flag, total_ft_median_income_change_outlier_flag
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        graduate_metric_rows,
    )

    pathway_rows = []
    for row in raw_data["vnda_course_occupations"]:
        if not row["course_id"]:
            load_stats["vnda_course_occupations"]["skipped_rows"] += 1
            continue
        pathway_rows.append(
            (
                "vnda_course_occupations",
                row["course_id"],
                row["occupation_name"],
                to_float(row.get("pct_share")),
                row["source_sheet"],
                row["anzsco_code"],
                row["anzsco_match_method"],
                to_float(row.get("anzsco_match_score")),
                row["anzsco_match_status"],
                to_int(row.get("course_occupation_rank")),
            )
        )
        load_stats["vnda_course_occupations"]["loaded_rows"] += 1
    cursor.executemany(
        """
        INSERT INTO program_occupation_pathway (
          dataset_code, program_id, occupation_name, pct_share, source_sheet,
          anzsco_code, anzsco_match_method, anzsco_match_score,
          anzsco_match_status, course_occupation_rank
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        pathway_rows,
    )

    def insert_graduate_summary(dataset_code: str, rows: list[dict[str, str | None]], scope: str, share_field: str) -> None:
        summary_rows = []
        for row in rows:
            state_code = None
            if row.get("state"):
                state_code = state_to_code(row["state"])
            summary_rows.append(
                (
                    summary_key(
                        scope,
                        dataset_code=dataset_code,
                        state_code=state_code,
                        aqf_level=row.get("aqf_level"),
                        field_of_education=row.get("foe"),
                        jurisdiction=row.get("jurisdiction"),
                        cohort_group=row.get("cohort_group"),
                        cohort=row.get("cohort"),
                        aqf_foe=row.get("aqf_foe"),
                    ),
                    dataset_code,
                    scope,
                    state_code,
                    row.get("aqf_level"),
                    row.get("foe"),
                    row.get("jurisdiction"),
                    row.get("cohort_group"),
                    row.get("cohort"),
                    row.get("aqf_foe"),
                    to_float(row.get(share_field)),
                    to_bool_int(row.get("small_count_flag")),
                    to_int(row.get("no_of_different_occupations")),
                    to_int(row.get("cert_order")),
                    to_float(row.get("pct_employed_prior")),
                    to_float(row.get("pct_employed_post")),
                    to_float(row.get("pptchange_employment")),
                    to_float(row.get("pct_employed_tot_prior")),
                    to_float(row.get("pct_employed_tot_post")),
                    to_float(row.get("pctpt_change_in_tot_employment")),
                    to_float(row.get("pct_employed_pt_prior")),
                    to_float(row.get("pct_employed_pt_post")),
                    to_float(row.get("pctpt_change_in_pt_employment")),
                    to_float(row.get("pt_prior_ft_post_pct_of_all_students")),
                    to_float(row.get("pct_employed_ft_prior")),
                    to_float(row.get("pct_employed_ft_post")),
                    to_float(row.get("pctpt_change_in_ft_employment")),
                    to_float(row.get("median_income")),
                    to_float(row.get("median_income_change")),
                    to_float(row.get("median_income_total")),
                    to_float(row.get("median_income_total_change")),
                    to_float(row.get("total_ft_median_income")),
                    to_float(row.get("total_ft_median_income_change")),
                    to_float(row.get("income_support_exit_rate")),
                    to_float(row.get("pct_higher_vet_progression")),
                    to_float(row.get("pct_any_vet_progression")),
                    to_float(row.get("pct_female")),
                    to_float(row.get("pct_disability")),
                    to_float(row.get("pct_apprentice_trainees")),
                    to_float(row.get("pct_first_nations")),
                    to_float(row.get("pct_no_yr12_no_cert_iii")),
                    to_float(row.get("pct_government_funded")),
                    to_float(row.get("median_completion_age_yrs")),
                    to_float(row.get("median_completion_time_days")),
                    to_float(row.get("pct_remote")),
                    to_float(row.get("pct_regional")),
                    to_float(row.get("pct_major_city")),
                    row.get("source_sheet"),
                    to_int(row.get("suppressed_value_count")) or 0,
                    to_bool_int(row.get("has_suppressed_values")) or 0,
                    to_bool_int(row.get("median_income_outlier_flag")) or 0,
                    to_bool_int(row.get("median_income_change_outlier_flag")) or 0,
                    to_bool_int(row.get("median_income_total_outlier_flag")) or 0,
                    to_bool_int(row.get("median_income_total_change_outlier_flag")) or 0,
                    to_bool_int(row.get("total_ft_median_income_outlier_flag")) or 0,
                    to_bool_int(row.get("total_ft_median_income_change_outlier_flag")) or 0,
                )
            )
            load_stats[dataset_code]["loaded_rows"] += 1
        cursor.executemany(
            """
            INSERT INTO graduate_outcome_summary (
              summary_key, dataset_code, summary_scope, state_code, aqf_level, field_of_education,
              jurisdiction_label, cohort_group, cohort_label, aqf_foe_label, scope_share_pct,
              small_count_flag, no_of_different_occupations, cert_order, pct_employed_prior,
              pct_employed_post, pptchange_employment, pct_employed_tot_prior, pct_employed_tot_post,
              pctpt_change_in_tot_employment, pct_employed_pt_prior, pct_employed_pt_post,
              pctpt_change_in_pt_employment, pt_prior_ft_post_pct_of_all_students,
              pct_employed_ft_prior, pct_employed_ft_post, pctpt_change_in_ft_employment,
              median_income, median_income_change, median_income_total, median_income_total_change,
              total_ft_median_income, total_ft_median_income_change, income_support_exit_rate,
              pct_higher_vet_progression, pct_any_vet_progression, pct_female, pct_disability,
              pct_apprentice_trainees, pct_first_nations, pct_no_yr12_no_cert_iii,
              pct_government_funded, median_completion_age_yrs, median_completion_time_days,
              pct_remote, pct_regional, pct_major_city, source_sheet, suppressed_value_count,
              has_suppressed_values, median_income_outlier_flag, median_income_change_outlier_flag,
              median_income_total_outlier_flag, median_income_total_change_outlier_flag,
              total_ft_median_income_outlier_flag, total_ft_median_income_change_outlier_flag
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            summary_rows,
        )

    insert_graduate_summary("vnda_national", raw_data["vnda_national"], "national_cohort", "pct_total")
    insert_graduate_summary("vnda_state", raw_data["vnda_state"], "state", "pct_total")
    insert_graduate_summary("vnda_aqf", raw_data["vnda_aqf"], "aqf", "pct_jurisdiction_total")
    insert_graduate_summary(
        "vnda_aqf_foe_national", raw_data["vnda_aqf_foe_national"], "aqf_foe_national", "pct_aqf_total"
    )
    insert_graduate_summary(
        "vnda_aqf_foe_state", raw_data["vnda_aqf_foe_state"], "aqf_foe_state", "pct_state_aqf"
    )

    survey_table_rows: dict[str, tuple] = {}
    survey_metric_keys: set[tuple[str, str, str, str, str]] = set()
    raw_survey_observations: list[tuple[tuple[str, str, str, str, str], dict[str, str | None]]] = []
    for row in raw_data["seuv"]:
        table_id = row["table_id"]
        if not table_id:
            load_stats["seuv"]["skipped_rows"] += 1
            continue
        if table_id not in survey_table_rows:
            survey_table_rows[table_id] = (
                table_id,
                row["table_number"],
                row["table_title"],
                row["slice_dataset"],
                to_bool_int(row.get("is_ai_module")) or 0,
                row["anzsco_join_note"],
            )
        metric_key = (
            table_id,
            row["slice_section"] or "",
            row["metric_label"] or "",
            row["measure_label"] or "",
            row["value_unit"] or "pct",
        )
        survey_metric_keys.add(metric_key)
        raw_survey_observations.append((metric_key, row))
        load_stats["seuv"]["loaded_rows"] += 1

    cursor.executemany(
        """
        INSERT INTO survey_table (
          table_id, table_number, table_title, slice_dataset, is_ai_module, anzsco_join_note
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        survey_table_rows.values(),
    )
    survey_metric_ids: dict[tuple[str, str, str, str, str], int] = {}
    for metric_key in sorted(survey_metric_keys):
        cursor.execute(
            """
            INSERT INTO survey_metric (
              table_id, slice_section, metric_label, measure_label, value_unit
            ) VALUES (?, ?, ?, ?, ?)
            """,
            metric_key,
        )
        survey_metric_ids[metric_key] = cursor.lastrowid

    survey_observation_rows = []
    for metric_key, row in raw_survey_observations:
        survey_observation_rows.append(
            (
                survey_metric_ids[metric_key],
                to_int(row.get("survey_year")),
                to_float(row.get("value")),
                row["value_raw"],
                row["value_status"],
                to_bool_int(row.get("value_has_asterisk")) or 0,
                to_bool_int(row.get("value_outlier_flag")) or 0,
            )
        )
    cursor.executemany(
        """
        INSERT INTO survey_observation (
          metric_id, survey_year, value, value_raw, value_status, value_has_asterisk, value_outlier_flag
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        survey_observation_rows,
    )

    apprenticeship_rows = []
    for row in raw_data["apprentices"]:
        state_code = state_to_code(row["state"])
        if not state_code:
            load_stats["apprentices"]["skipped_rows"] += 1
            continue
        apprenticeship_rows.append(
            (
                "apprentices",
                state_code,
                row["contract_type"],
                row["collection_quarter"],
                to_int(row.get("collection_number")),
                row["review_quarter_date"],
                to_float(row.get("estimate")),
                to_float(row.get("model_estimate")),
                row["estimate_type"],
                to_float(row.get("ci_lower_95")),
                to_float(row.get("ci_upper_95")),
                to_int(row.get("final_count")),
                to_float(row.get("pct_of_final_count")),
                to_bool_int(row.get("final_count_in_pi")),
                to_int(row.get("raw_collected_count")),
                to_float(row.get("model_pct_of_final_count")),
                to_int(row.get("collection_year")),
                to_int(row.get("collection_quarter_number")),
                row["collection_quarter_label"],
                to_float(row.get("abs_pct_error")),
                to_bool_int(row.get("within_5pct_of_final")) or 0,
                to_bool_int(row.get("pct_of_final_count_outlier_flag")) or 0,
                row["anzsco_join_note"],
            )
        )
        load_stats["apprentices"]["loaded_rows"] += 1
    cursor.executemany(
        """
        INSERT INTO apprenticeship_estimate (
          dataset_code, state_code, contract_type, collection_quarter, collection_number,
          review_quarter_date, estimate, model_estimate, estimate_type, ci_lower_95, ci_upper_95,
          final_count, pct_of_final_count, final_count_in_pi, raw_collected_count,
          model_pct_of_final_count, collection_year, collection_quarter_number,
          collection_quarter_label, abs_pct_error, within_5pct_of_final,
          pct_of_final_count_outlier_flag, anzsco_join_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        apprenticeship_rows,
    )

    loaded_at = now_iso()
    for dataset_code, meta in DATASET_META.items():
        file_path = CLEANED_DIR / meta["file"]
        modified_at = datetime.fromtimestamp(file_path.stat().st_mtime).replace(microsecond=0).isoformat()
        cursor.execute(
            """
            INSERT INTO dataset_load (
              run_id, dataset_code, cleaned_csv_path, loaded_rows, skipped_rows, file_modified_at, loaded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                dataset_code,
                str(file_path),
                load_stats[dataset_code]["loaded_rows"],
                load_stats[dataset_code]["skipped_rows"],
                modified_at,
                loaded_at,
            ),
        )

    issue_rows = [
        (
            run_id,
            issue["dataset_code"],
            issue["entity_name"],
            issue["issue_type"],
            issue["severity"],
            issue["record_key"],
            issue["message"],
            loaded_at,
        )
        for issue in issues
    ]
    if issue_rows:
        cursor.executemany(
            """
            INSERT INTO data_quality_issue (
              run_id, dataset_code, entity_name, issue_type, severity, record_key, message, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            issue_rows,
        )

    metrics_to_insert: list[tuple] = []

    def add_metric(dataset_code: str, entity_name: str, dimension: str, numerator: float, denominator: float, measure: str, notes: str) -> None:
        score = numerator / denominator if denominator not in (0, 0.0) and dimension != "timeliness" else numerator
        metrics_to_insert.append(
            (run_id, dataset_code, entity_name, dimension, numerator, denominator, score, measure, notes, loaded_at)
        )

    for dataset_code, rows in raw_data.items():
        numerator, denominator, score = completeness_ratio(rows, REQUIRED_FIELDS[dataset_code])
        add_metric(dataset_code, dataset_code, "completeness", numerator, denominator, "required_field_fill_ratio", "Required columns defined by the normalized load contract.")

        numerator, denominator, score = uniqueness_ratio(rows, BUSINESS_KEYS[dataset_code])
        add_metric(dataset_code, dataset_code, "uniqueness", numerator, denominator, "distinct_business_keys_over_rows", "Duplicate source rows lower this score.")

        total_rows = float(len(rows))
        loaded_rows = float(load_stats[dataset_code]["loaded_rows"])
        add_metric(dataset_code, dataset_code, "validity", loaded_rows, total_rows, "rows_loaded_over_source_rows", "Rows excluded during normalization lower this score.")

        file_path = CLEANED_DIR / DATASET_META[dataset_code]["file"]
        freshness_days = max((datetime.fromisoformat(loaded_at) - datetime.fromtimestamp(file_path.stat().st_mtime)).total_seconds() / 86400.0, 0.0)
        add_metric(dataset_code, dataset_code, "timeliness", freshness_days, 1.0, "days_since_cleaned_csv_modified", "Lower is fresher. Uses the cleaned CSV file timestamp.")

    title_match_count = 0
    for row in raw_data["osl_filtered"]:
        key = (row["anzsco_code"], normalize_text(row["occupation_title"]))
        if row["anzsco_code"] and normalize_text(row["occupation_title"]) and key in alias_match_lookup:
            title_match_count += 1
    add_metric(
        "osl_filtered",
        "occupation_shortage_snapshot",
        "accuracy",
        float(title_match_count),
        float(load_stats["osl_filtered"]["loaded_rows"]),
        "titles_matching_authoritative_anzsco_alias",
        "Measures how often shortage titles resolve cleanly to the ANZSCO title dimension.",
    )

    matched_pathways = cursor.execute(
        """
        SELECT COUNT(*)
        FROM program_occupation_pathway
        WHERE dataset_code = 'vnda_course_occupations'
          AND anzsco_code IS NOT NULL
        """
    ).fetchone()[0]
    total_pathways = cursor.execute(
        """
        SELECT COUNT(*)
        FROM program_occupation_pathway
        WHERE dataset_code = 'vnda_course_occupations'
        """
    ).fetchone()[0]
    add_metric(
        "vnda_course_occupations",
        "program_occupation_pathway",
        "consistency",
        float(matched_pathways),
        float(total_pathways),
        "rows_with_anzsco_link_over_total_rows",
        "Unknown occupations remain nullable; linked rows are consistent across the occupation bridge.",
    )
    add_metric(
        "vnda_course_occupations",
        "program_occupation_pathway",
        "accuracy",
        float(matched_pathways),
        float(total_pathways),
        "rows_matched_to_authoritative_anzsco_reference",
        "Uses ANZSCO linkage coverage as the practical accuracy measure for occupation mapping.",
    )

    fk_ok = cursor.execute(
        """
        SELECT COUNT(*)
        FROM program_occupation_pathway pop
        LEFT JOIN occupation o
          ON o.anzsco_code = pop.anzsco_code
        WHERE pop.dataset_code = 'vnda_course_occupations'
          AND (pop.anzsco_code IS NULL OR o.anzsco_code IS NOT NULL)
        """
    ).fetchone()[0]
    add_metric(
        "vnda_course_occupations",
        "program_occupation_pathway",
        "referential_integrity",
        float(fk_ok),
        float(total_pathways),
        "valid_or_nullable_foreign_keys_over_total_rows",
        "Measures bridge-table foreign key soundness after load.",
    )

    add_metric(
        "vnda_course_occupations",
        "program_occupation_pathway",
        "normalization",
        1.0,
        1.0,
        "bridge_table_present",
        "The many-to-many relationship between programs and occupations is resolved through program_occupation_pathway.",
    )

    cursor.executemany(
        """
        INSERT INTO data_quality_metric (
          run_id, dataset_code, entity_name, quality_dimension, numerator,
          denominator, score, measure_name, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        metrics_to_insert,
    )

    finished_at = now_iso()
    cursor.execute("UPDATE ingestion_run SET finished_at = ? WHERE run_id = ?", (finished_at, run_id))
    conn.commit()

    export_definitions = {
        "occupations.csv": "SELECT * FROM vw_frontend_occupations ORDER BY occupation_title",
        "programs.csv": "SELECT * FROM vw_frontend_programs ORDER BY program_name",
        "pathways.csv": "SELECT * FROM vw_frontend_pathways ORDER BY program_name, course_occupation_rank, preferred_occupation_title",
    }
    for filename, query in export_definitions.items():
        result = conn.execute(query)
        columns = [item[0] for item in result.description]
        rows = [tuple(row) for row in result.fetchall()]
        write_csv(FRONTEND_DIR / filename, columns, rows)

    dump_output = subprocess.run(
        ["sqlite3", str(DB_PATH), ".dump"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    cleaned_dump_lines = ["PRAGMA defer_foreign_keys = true;"]
    skipping_cf_kv = False
    for line in dump_output.splitlines():
        stripped = line.strip()
        if stripped in {"PRAGMA foreign_keys=OFF;", "BEGIN TRANSACTION;", "COMMIT;"}:
            continue
        if stripped.startswith("CREATE TABLE _cf_KV"):
            skipping_cf_kv = True
            continue
        if skipping_cf_kv:
            if stripped.endswith("WITHOUT ROWID;"):
                skipping_cf_kv = False
            continue
        cleaned_dump_lines.append(line)
    D1_SQL_PATH.write_text("\n".join(cleaned_dump_lines) + "\n", encoding="utf-8")

    conn.close()

    print(f"Built SQLite database: {DB_PATH}")
    print(f"Prepared D1 import SQL: {D1_SQL_PATH}")
    print(f"Exported frontend CSVs to: {FRONTEND_DIR}")
    for filename in export_definitions:
        print(f"  - {filename}")


if __name__ == "__main__":
    main()
