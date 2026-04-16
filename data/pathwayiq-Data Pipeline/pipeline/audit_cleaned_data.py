"""
Audit the cleaned CSV outputs and save machine-readable summaries.
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

import pandas as pd


PIPELINE_DIR = Path(__file__).parent
CLEANED_DIR = PIPELINE_DIR.parent / "cleaned_data"
LOG_DIR = PIPELINE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

TEXT_SENTINELS = {"na", "np", "n/a", "n.a.", "..."}
STRUCT_PAT = re.compile(
    r"back to|notes on tables|source:|95% margin|unit groups?|unit group title|"
    r"shortage drivers|employer characteristics|state/territory \(base|"
    r"industry \(base|employer size \(base",
    re.I,
)
ROMAN_DAMAGE_PAT = re.compile(r"\bIi\b|\bIii\b|\bIv\b")
APOSTROPHE_DAMAGE_PAT = re.compile(r"'S\b")


def _normalise_text(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip()


def _issue(dataset: str, issue_type: str, severity: str = "warning", **details) -> dict:
    return {
        "dataset": dataset,
        "issue_type": issue_type,
        "severity": severity,
        **details,
    }


def _row_context(row: pd.Series, columns: list[str]) -> dict:
    context = {}
    for col in columns:
        if col in row.index:
            val = row[col]
            if pd.notna(val):
                context[col] = val
    return context


def _append_flagged_rows(
    flagged_rows: list[dict],
    dataset: str,
    issue_type: str,
    df: pd.DataFrame,
    mask: pd.Series,
    columns: list[str] | None = None,
) -> None:
    columns = columns or list(df.columns[:6])
    for idx, row in df.loc[mask].iterrows():
        flagged_rows.append({
            "dataset": dataset,
            "row_index": int(idx),
            "csv_row_number": int(idx) + 2,
            "issue_type": issue_type,
            "context": json.dumps(_row_context(row, columns), default=str),
        })


def _scan_headers(dataset: str, df: pd.DataFrame, issues: list[dict]) -> None:
    blank_headers = [c for c in df.columns if str(c).strip() == ""]
    unnamed_headers = [c for c in df.columns if str(c).lower().startswith("unnamed")]
    numeric_headers = [c for c in df.columns if re.fullmatch(r"\d+", str(c))]
    if blank_headers:
        issues.append(_issue(dataset, "blank_header", columns=blank_headers, count=len(blank_headers)))
    if unnamed_headers:
        issues.append(_issue(dataset, "unnamed_header", columns=unnamed_headers, count=len(unnamed_headers)))
    if numeric_headers:
        issues.append(_issue(dataset, "numeric_header_placeholder", columns=numeric_headers, count=len(numeric_headers)))


def _scan_generic_columns(dataset: str, df: pd.DataFrame, issues: list[dict], flagged_rows: list[dict]) -> None:
    text_cols = [c for c in df.columns if df[c].dtype == object]
    for col in text_cols:
        vals = _normalise_text(df[col].dropna())
        low = vals.str.lower()

        skip_text_sentinel = dataset.startswith("clean_seuv") and col == "value_raw"
        sent_mask = df[col].notna() & _normalise_text(df[col]).str.lower().isin(TEXT_SENTINELS)
        sent_count = int(sent_mask.sum())
        if sent_count and not skip_text_sentinel:
            issues.append(_issue(
                dataset,
                "text_sentinel",
                column=col,
                count=sent_count,
                examples=vals[low.isin(TEXT_SENTINELS)].drop_duplicates().head(10).tolist(),
            ))
            _append_flagged_rows(flagged_rows, dataset, "text_sentinel", df, sent_mask, [col])

        skip_structural_text = dataset.startswith("clean_seuv") and col == "table_title"
        if not col.endswith("_note") and not skip_structural_text:
            struct_mask = df[col].notna() & _normalise_text(df[col]).str.contains(STRUCT_PAT, regex=True)
            struct_count = int(struct_mask.sum())
            if struct_count:
                issues.append(_issue(
                    dataset,
                    "structural_text",
                    column=col,
                    count=struct_count,
                    examples=vals[vals.str.contains(STRUCT_PAT, regex=True)].drop_duplicates().head(10).tolist(),
                ))
                _append_flagged_rows(flagged_rows, dataset, "structural_text", df, struct_mask, [col])

        roman_mask = df[col].notna() & _normalise_text(df[col]).str.contains(ROMAN_DAMAGE_PAT, regex=True)
        roman_count = int(roman_mask.sum())
        if roman_count:
            issues.append(_issue(
                dataset,
                "roman_numeral_damage",
                column=col,
                count=roman_count,
                examples=vals[vals.str.contains(ROMAN_DAMAGE_PAT, regex=True)].drop_duplicates().head(10).tolist(),
            ))
            _append_flagged_rows(flagged_rows, dataset, "roman_numeral_damage", df, roman_mask, [col])

        apostrophe_mask = df[col].notna() & _normalise_text(df[col]).str.contains(APOSTROPHE_DAMAGE_PAT, regex=True)
        apostrophe_count = int(apostrophe_mask.sum())
        if apostrophe_count:
            issues.append(_issue(
                dataset,
                "apostrophe_damage",
                column=col,
                count=apostrophe_count,
                examples=vals[vals.str.contains(APOSTROPHE_DAMAGE_PAT, regex=True)].drop_duplicates().head(10).tolist(),
            ))
            _append_flagged_rows(flagged_rows, dataset, "apostrophe_damage", df, apostrophe_mask, [col])

    for col in df.columns:
        numeric = pd.to_numeric(df[col], errors="coerce")
        if numeric.notna().sum() == 0:
            continue
        display = numeric.dropna().map(lambda x: format(float(x), ".15g"))
        max_decs = int(display.map(lambda x: len(x.split(".")[1]) if "." in x else 0).max())
        if max_decs > 3:
            issues.append(_issue(
                dataset,
                "high_precision_numeric",
                column=col,
                max_decimal_places=max_decs,
            ))

        if col.endswith("_outlier_flag"):
            base_col = col[:-13]
            if base_col in df.columns:
                flagged_on_null_mask = (
                    pd.to_numeric(df[base_col], errors="coerce").isna()
                    & df[col].astype(str).str.lower().eq("true")
                )
                flagged_on_null = int(flagged_on_null_mask.sum())
                if flagged_on_null:
                    issues.append(_issue(
                        dataset,
                        "outlier_flag_on_null",
                        column=col,
                        count=flagged_on_null,
                    ))
                    _append_flagged_rows(flagged_rows, dataset, "outlier_flag_on_null", df, flagged_on_null_mask, [base_col, col])


def _scan_apprentices(dataset: str, df: pd.DataFrame, issues: list[dict], flagged_rows: list[dict]) -> None:
    if "estimate" in df.columns:
        mask = df["estimate"].dropna().map(lambda x: round(float(x), 1) != float(x))
        mask = mask.reindex(df.index, fill_value=False)
        count = int(mask.sum())
        if count:
            issues.append(_issue(dataset, "estimate_precision_gt_1dp", column="estimate", count=count))
            _append_flagged_rows(flagged_rows, dataset, "estimate_precision_gt_1dp", df, mask, ["state", "contract_type", "collection_quarter", "estimate"])

    if "collection_quarter_label" in df.columns:
        mask = df["collection_quarter_label"].notna() & ~df["collection_quarter_label"].astype(str).str.fullmatch(r"\d{4}-Q[1-4]")
        count = int(mask.sum())
        if count:
            issues.append(_issue(dataset, "invalid_collection_quarter_label", column="collection_quarter_label", count=count))
            _append_flagged_rows(flagged_rows, dataset, "invalid_collection_quarter_label", df, mask, ["collection_quarter", "collection_quarter_label"])


def _scan_osd(dataset: str, df: pd.DataFrame, issues: list[dict], flagged_rows: list[dict]) -> None:
    if "unit_group" in df.columns:
        mask = df["unit_group"].fillna("").str.contains(r"unit groups?|unit group title|shortage drivers|^total$|figure c1", case=False, regex=True)
        count = int(mask.sum())
        if count:
            issues.append(_issue(dataset, "structural_osd_row", column="unit_group", count=count))
            _append_flagged_rows(flagged_rows, dataset, "structural_osd_row", df, mask, ["unit_group", "source_table"])

    if "anzsco_code" in df.columns:
        issues.append(_issue(dataset, "unexpected_anzsco_code_column", severity="error", columns=["anzsco_code"], count=1))

    for col in ["ivi_ue_ratio", "employment_growth_5yr"]:
        if col not in df.columns:
            continue
        numeric = pd.to_numeric(df[col], errors="coerce")
        mask = numeric.notna() & numeric.map(lambda x: round(float(x), 2) != float(x))
        count = int(mask.sum())
        if count:
            issues.append(_issue(dataset, "osd_precision_gt_2dp", column=col, count=count))
            _append_flagged_rows(flagged_rows, dataset, "osd_precision_gt_2dp", df, mask, ["unit_group", col])


def _scan_vet_outcomes(dataset: str, df: pd.DataFrame, issues: list[dict], flagged_rows: list[dict]) -> None:
    label_cols = [c for c in df.columns if c.startswith("industry_") and not c.endswith("_pct")]
    for col in label_cols:
        mask = df[col].notna() & df[col].astype(str).str.strip().str.lower().isin(TEXT_SENTINELS)
        count = int(mask.sum())
        if count:
            issues.append(_issue(dataset, "industry_label_sentinel", column=col, count=count))
            _append_flagged_rows(flagged_rows, dataset, "industry_label_sentinel", df, mask, ["program_id", col])


def _scan_vet_long(dataset: str, df: pd.DataFrame, issues: list[dict], flagged_rows: list[dict], kind: str) -> None:
    if "rank" in df.columns:
        mask = ~df["rank"].astype(str).str.fullmatch(rf"{kind}_top\d+")
        count = int(mask.sum())
        if count:
            issues.append(_issue(dataset, "unexpected_rank", column="rank", count=count, expected=f"{kind}_topN"))
            _append_flagged_rows(flagged_rows, dataset, "unexpected_rank", df, mask, ["program_id", "rank"])

    if kind == "occ" and {"rank", "pct_employed_in_occ"}.issubset(df.columns):
        mask = df["rank"].eq("occ_top1") & pd.to_numeric(df["pct_employed_in_occ"], errors="coerce").isna()
        count = int(mask.sum())
        if count:
            issues.append(_issue(dataset, "occ_top1_missing_pct", column="pct_employed_in_occ", count=count))
            _append_flagged_rows(flagged_rows, dataset, "occ_top1_missing_pct", df, mask, ["program_id", "occupation_label", "rank", "pct_employed_in_occ"])

    if kind == "ind" and "industry_label" in df.columns:
        mask = df["industry_label"].notna() & df["industry_label"].astype(str).str.strip().str.lower().isin(TEXT_SENTINELS)
        count = int(mask.sum())
        if count:
            issues.append(_issue(dataset, "industry_label_sentinel", column="industry_label", count=count))
            _append_flagged_rows(flagged_rows, dataset, "industry_label_sentinel", df, mask, ["program_id", "industry_label", "rank"])


def _scan_vnda(dataset: str, df: pd.DataFrame, issues: list[dict]) -> None:
    if {"source_sheet", "cohort_group"}.issubset(df.columns):
        populated_sheets = sorted(df.loc[df["cohort_group"].notna(), "source_sheet"].dropna().unique().tolist())
        if populated_sheets and len(populated_sheets) == 1:
            issues.append(_issue(
                dataset,
                "sheet_specific_column_sparsity",
                column="cohort_group",
                count=int(df["cohort_group"].notna().sum()),
                populated_sheets=populated_sheets,
            ))

    if {"source_sheet", "cohort"}.issubset(df.columns):
        populated_sheets = sorted(df.loc[df["cohort"].notna(), "source_sheet"].dropna().unique().tolist())
        if populated_sheets and len(populated_sheets) == 1:
            issues.append(_issue(
                dataset,
                "sheet_specific_column_sparsity",
                column="cohort",
                count=int(df["cohort"].notna().sum()),
                populated_sheets=populated_sheets,
            ))


def _scan_vnda_qual_occ(dataset: str, df: pd.DataFrame, issues: list[dict], flagged_rows: list[dict]) -> None:
    if "occupation_name" in df.columns and "anzsco_match_status" not in df.columns:
        unknown_mask = df["occupation_name"].fillna("").str.strip().str.lower().eq("unknown")
        unknown_count = int(unknown_mask.sum())
        if unknown_count:
            issues.append(_issue(dataset, "unknown_occupation_name", column="occupation_name", count=unknown_count))
            _append_flagged_rows(flagged_rows, dataset, "unknown_occupation_name", df, unknown_mask, ["course_id", "occupation_name"])

    if {"occupation_name", "anzsco_code"}.issubset(df.columns):
        unmatched_mask = df["anzsco_code"].isna()
        if "anzsco_match_status" in df.columns:
            unmatched_mask &= ~df["anzsco_match_status"].isin(["unknown_occupation", "not_further_defined"])
        else:
            unmatched_mask &= ~df["occupation_name"].fillna("").str.strip().str.lower().eq("unknown")
        unmatched_count = int(unmatched_mask.sum())
        if unmatched_count:
            top_examples = (
                df.loc[unmatched_mask, "occupation_name"]
                .value_counts()
                .head(10)
                .to_dict()
            )
            issues.append(_issue(
                dataset,
                "unmatched_occupation_lookup",
                column="anzsco_code",
                count=unmatched_count,
                top_examples=top_examples,
            ))
            _append_flagged_rows(flagged_rows, dataset, "unmatched_occupation_lookup", df, unmatched_mask, ["course_id", "occupation_name", "anzsco_code"])


def _scan_osl_full(dataset: str, df: pd.DataFrame, issues: list[dict]) -> None:
    expected_state_cols = ["nsw_rating", "vic_rating", "qld_rating", "sa_rating", "wa_rating", "tas_rating", "nt_rating", "act_rating"]
    missing = [c for c in expected_state_cols if c not in df.columns]
    if missing:
        issues.append(_issue(dataset, "missing_standard_state_rating_columns", columns=missing, count=len(missing)))
    if "national_shortage_rating" not in df.columns:
        issues.append(_issue(dataset, "missing_national_shortage_rating", columns=["national_shortage_rating"], count=1))


def _scan_seuv(dataset: str, df: pd.DataFrame, issues: list[dict], flagged_rows: list[dict]) -> None:
    if "table_id" in df.columns:
        table_count = int(df["table_id"].nunique())
        if table_count != 29:
            issues.append(_issue(dataset, "unexpected_table_count", severity="error", count=table_count, expected=29))

    if "is_ai_module" in df.columns:
        ai_rows = int(df["is_ai_module"].fillna(False).sum())
        if ai_rows == 0:
            issues.append(_issue(dataset, "missing_ai_module_rows", severity="error", count=0))

    if {"value", "survey_year", "value_unit"}.issubset(df.columns):
        mask = (
            pd.to_numeric(df["value"], errors="coerce")
            .eq(pd.to_numeric(df["survey_year"], errors="coerce"))
            & df["value_unit"].fillna("").eq("pct")
        )
        count = int(mask.sum())
        if count:
            issues.append(_issue(dataset, "value_equals_survey_year", column="value", count=count))
            _append_flagged_rows(flagged_rows, dataset, "value_equals_survey_year", df, mask, ["table_id", "slice_section", "metric_label", "measure_label", "survey_year", "value"])

        pct_mask = df["value_unit"].fillna("").eq("pct") & pd.to_numeric(df["value"], errors="coerce").notna()
        pct_out_of_range = pct_mask & ~pd.to_numeric(df["value"], errors="coerce").between(0, 100)
        count = int(pct_out_of_range.sum())
        if count:
            issues.append(_issue(dataset, "pct_out_of_range", column="value", count=count))
            _append_flagged_rows(flagged_rows, dataset, "pct_out_of_range", df, pct_out_of_range, ["table_id", "metric_label", "measure_label", "survey_year", "value"])


def _scan_file(path: Path) -> dict:
    dataset = path.name
    df = pd.read_csv(path)
    issues: list[dict] = []
    flagged_rows: list[dict] = []

    _scan_headers(dataset, df, issues)
    _scan_generic_columns(dataset, df, issues, flagged_rows)

    dataset_key = path.stem
    if dataset_key == "clean_apprentices":
        _scan_apprentices(dataset, df, issues, flagged_rows)
    elif dataset_key == "clean_osd":
        _scan_osd(dataset, df, issues, flagged_rows)
    elif dataset_key == "clean_vet_outcomes":
        _scan_vet_outcomes(dataset, df, issues, flagged_rows)
    elif dataset_key == "clean_vet_outcomes_occ_long":
        _scan_vet_long(dataset, df, issues, flagged_rows, kind="occ")
    elif dataset_key == "clean_vet_outcomes_ind_long":
        _scan_vet_long(dataset, df, issues, flagged_rows, kind="ind")
    elif dataset_key == "clean_vnda":
        _scan_vnda(dataset, df, issues)
    elif dataset_key == "clean_vnda_qual_by_occ":
        _scan_vnda_qual_occ(dataset, df, issues, flagged_rows)
    elif dataset_key == "clean_osl_full":
        _scan_osl_full(dataset, df, issues)
    elif dataset_key == "clean_seuv":
        _scan_seuv(dataset, df, issues, flagged_rows)

    return {
        "dataset": dataset,
        "shape": {"rows": int(df.shape[0]), "cols": int(df.shape[1])},
        "issues": issues,
        "flagged_rows": flagged_rows,
    }


def run() -> dict[str, Path]:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    reports = [_scan_file(path) for path in sorted(CLEANED_DIR.glob("clean_*.csv"))]

    summary_rows = []
    issue_rows = []
    flagged_rows = []

    for report in reports:
        summary_rows.append({
            "dataset": report["dataset"],
            "rows": report["shape"]["rows"],
            "cols": report["shape"]["cols"],
            "issue_count": len(report["issues"]),
            "flagged_row_count": len(report["flagged_rows"]),
        })
        issue_rows.extend(report["issues"])
        flagged_rows.extend(report["flagged_rows"])

    json_path = LOG_DIR / f"cleaned_data_audit_{stamp}.json"
    summary_path = LOG_DIR / f"cleaned_data_audit_summary_{stamp}.csv"
    issue_path = LOG_DIR / f"cleaned_data_audit_issues_{stamp}.csv"
    flagged_path = LOG_DIR / f"cleaned_data_audit_flagged_rows_{stamp}.csv"

    json_path.write_text(json.dumps(reports, indent=2, default=str), encoding="utf-8")
    pd.DataFrame(summary_rows).to_csv(summary_path, index=False)
    pd.DataFrame(issue_rows).to_csv(issue_path, index=False)
    pd.DataFrame(flagged_rows).to_csv(flagged_path, index=False)

    print(f"JSON        -> {json_path}")
    print(f"Summary CSV -> {summary_path}")
    print(f"Issues CSV  -> {issue_path}")
    print(f"Rows CSV    -> {flagged_path}")
    return {
        "json_path": json_path,
        "summary_path": summary_path,
        "issue_path": issue_path,
        "flagged_path": flagged_path,
    }


if __name__ == "__main__":
    run()
