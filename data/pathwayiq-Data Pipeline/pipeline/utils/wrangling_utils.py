"""
utils/wrangling_utils.py — TA28 Pipeline Shared Utilities
==========================================================
All reusable functions for the pipeline. Scripts import from here to avoid
code duplication and ensure every dataset goes through the same quality gates.

Design principles
-----------------
* No hardcoded column names or transformations — callers pass config dicts.
* Every mutation is logged with before/after statistics.
* Profiling is wrapped here so all scripts get consistent reports.
* Validation raises warnings (not exceptions) so the pipeline keeps running
  and surfaces a full list of issues at the end.
"""

from __future__ import annotations

import json
import logging
import re
import unicodedata
import warnings
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

TEXT_NULL_TOKENS = {"", "nan", "none", "na", "n/a", "n.a.", "np", "..."}
NUMERIC_SENTINELS = {"na", "n/a", "n.a.", "-", "–", "*", "...", " ", "", "s", "np"}


# ── Logging ─────────────────────────────────────────────────────────────────

def get_logger(name: str, log_dir: Path) -> logging.Logger:
    """Return a logger that writes to both console and a dated file."""
    log_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = log_dir / f"{name}_{stamp}.log"

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    if logger.handlers:        # prevent duplicate handlers on re-runs
        logger.handlers.clear()

    fmt = logging.Formatter("%(asctime)s | %(levelname)-8s | %(message)s",
                            datefmt="%H:%M:%S")
    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)

    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(fmt)

    logger.addHandler(fh)
    logger.addHandler(ch)
    return logger


# ── Audit trail ─────────────────────────────────────────────────────────────

class TransformationLog:
    """
    Accumulates a structured record of every transformation applied to a
    DataFrame.  Call .save() at the end of a script to persist it as JSON.
    """

    def __init__(self, dataset_name: str):
        self.dataset = dataset_name
        self.steps: list[dict] = []
        self._start = datetime.now()

    def record(
        self,
        step: str,
        description: str,
        rows_before: int | None = None,
        rows_after: int | None = None,
        cols_before: int | None = None,
        cols_after: int | None = None,
        details: dict | None = None,
    ) -> None:
        self.steps.append({
            "timestamp": datetime.now().isoformat(),
            "step":      step,
            "description": description,
            "rows_before": rows_before,
            "rows_after":  rows_after,
            "cols_before": cols_before,
            "cols_after":  cols_after,
            "details":     details or {},
        })

    def save(self, log_dir: Path) -> Path:
        log_dir.mkdir(parents=True, exist_ok=True)
        stamp = self._start.strftime("%Y%m%d_%H%M%S")
        path  = log_dir / f"audit_{self.dataset}_{stamp}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"dataset": self.dataset,
                       "pipeline_start": self._start.isoformat(),
                       "pipeline_end":   datetime.now().isoformat(),
                       "steps": self.steps}, f, indent=2, default=str)
        return path


# ── Discovery / Profiling ────────────────────────────────────────────────────

def run_profile(
    df: pd.DataFrame,
    title: str,
    output_path: Path,
    minimal: bool = True,
) -> None:
    """
    Run YData Profiling and save an HTML report.
    Gracefully degrades to a basic pandas describe() if ydata-profiling
    is not installed (so the pipeline never fails on a missing optional dep).
    """
    try:
        from ydata_profiling import ProfileReport
        profile = ProfileReport(
            df,
            title=title,
            minimal=minimal,
            progress_bar=False,
            correlations={"auto": {"calculate": True}},
            samples={"head": 5, "tail": 5},
        )
        profile.to_file(output_path)
    except ImportError:
        warnings.warn("ydata-profiling not installed; falling back to describe()")
        summary = df.describe(include="all").to_string()
        output_path.with_suffix(".txt").write_text(summary, encoding="utf-8")


# ── Header utilities ─────────────────────────────────────────────────────────

def find_header_row(df_raw: pd.DataFrame, anchor: str) -> int:
    """
    Scan row-by-row for the first row whose string representation contains
    `anchor` (case-insensitive).  Returns the 0-based row index.
    Raises ValueError if not found.
    """
    for i, row in df_raw.iterrows():
        row_str = " ".join(str(v) for v in row if pd.notna(v))
        if anchor.lower() in row_str.lower():
            return i
    raise ValueError(f"Header anchor '{anchor}' not found in DataFrame")


def clean_headers(df: pd.DataFrame, rename_map: dict | None = None) -> pd.DataFrame:
    """
    Normalise column headers:
    1. Apply explicit rename_map (partial — only listed cols are renamed).
    2. Auto-snake-case everything else:
       strip whitespace → lower → replace non-alphanumeric with _ → deduplicate.
    """
    df = df.copy()

    # Step 1 — explicit renames
    if rename_map:
        df = df.rename(columns=rename_map)

    # Step 2 — auto-snake-case remaining cols
    def _snake(name: str) -> str:
        name = str(name)
        name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
        name = name.strip().lower()
        name = re.sub(r"\s+", "_", name)
        name = re.sub(r"[^\w]", "_", name)
        name = re.sub(r"_+", "_", name)
        return name.strip("_")

    new_cols: dict[str, str] = {}
    seen: dict[str, int] = {}
    for idx, col in enumerate(df.columns):
        s = _snake(col)
        if not s:
            s = f"unnamed_{idx}"
        if s in seen:
            seen[s] += 1
            s = f"{s}_{seen[s]}"
        else:
            seen[s] = 0
        new_cols[col] = s

    return df.rename(columns=new_cols)


# ── Structural cleaning ──────────────────────────────────────────────────────

def drop_empty_rows_cols(
    df: pd.DataFrame,
    logger: logging.Logger,
    tlog: TransformationLog,
    empty_threshold: float = 0.95,
) -> pd.DataFrame:
    """
    Drop columns and rows that are almost entirely empty.
    `empty_threshold` = fraction of NaN above which a col/row is dropped.
    """
    r0, c0 = df.shape
    col_null_frac = df.isnull().mean()
    drop_cols = col_null_frac[col_null_frac >= empty_threshold].index.tolist()
    df = df.drop(columns=drop_cols)

    row_null_frac = df.isnull().mean(axis=1)
    drop_rows = row_null_frac[row_null_frac >= empty_threshold].index
    df = df.drop(index=drop_rows)

    r1, c1 = df.shape
    logger.info(f"drop_empty: removed {c0-c1} cols, {r0-r1} rows "
                f"(threshold {empty_threshold:.0%})")
    tlog.record("drop_empty_rows_cols",
                f"Removed near-empty rows/cols (>{empty_threshold:.0%} null)",
                r0, r1, c0, c1,
                {"dropped_cols": drop_cols, "rows_removed": int(r0 - r1)})
    return df


def drop_formula_cols(
    df: pd.DataFrame,
    formula_prefix: str,
    logger: logging.Logger,
    tlog: TransformationLog,
) -> pd.DataFrame:
    """
    Drop any column whose first non-null value starts with `formula_prefix`
    (e.g. "=") — these are Excel formula artefacts.
    """
    r0, c0 = df.shape
    to_drop = []
    for col in df.columns:
        first_val = df[col].dropna().iloc[0] if df[col].notna().any() else None
        if first_val is not None and str(first_val).startswith(formula_prefix):
            to_drop.append(col)
    df = df.drop(columns=to_drop)
    logger.info(f"drop_formula_cols: removed {len(to_drop)} formula columns")
    tlog.record("drop_formula_cols", "Dropped Excel formula-value columns",
                r0, df.shape[0], c0, df.shape[1],
                {"dropped": to_drop})
    return df


def remove_duplicates(
    df: pd.DataFrame,
    subset: list[str] | None,
    logger: logging.Logger,
    tlog: TransformationLog,
) -> pd.DataFrame:
    r0 = len(df)
    df = df.drop_duplicates(subset=subset, keep="first")
    removed = r0 - len(df)
    if removed:
        logger.warning(f"remove_duplicates: {removed} duplicate rows removed "
                       f"(key: {subset})")
    tlog.record("remove_duplicates",
                f"Removed {removed} duplicate rows",
                r0, len(df),
                details={"key_cols": subset, "duplicates_removed": removed})
    return df


# ── Type casting ─────────────────────────────────────────────────────────────

def coerce_numeric_series(series: pd.Series) -> pd.Series:
    """
    Coerce a Series to numeric while handling workbook-style sentinels.
    Strips commas and significance markers like '*'.
    """
    cleaned = (
        series
        .astype(str)
        .str.strip()
        .str.replace(",", "", regex=False)
        .str.replace("*", "", regex=False)
        .str.lower()
    )
    cleaned = cleaned.mask(cleaned.isin(NUMERIC_SENTINELS), np.nan)
    return pd.to_numeric(
        cleaned,
        errors="coerce",
    )


def cast_numeric_cols(
    df: pd.DataFrame,
    cols: list[str],
    logger: logging.Logger,
    tlog: TransformationLog,
) -> pd.DataFrame:
    """
    Coerce a list of columns to numeric, replacing non-parseable values with NaN.
    Handles 'na', 'n/a', '-', '*' sentinel strings from the raw data.
    """
    for col in cols:
        if col not in df.columns:
            continue
        before_nulls = df[col].isna().sum()
        df[col] = coerce_numeric_series(df[col])
        after_nulls = df[col].isna().sum()
        coerced = int(after_nulls - before_nulls)
        if coerced:
            logger.info(f"cast_numeric: '{col}' — {coerced} values coerced to NaN")
        tlog.record("cast_numeric", f"Cast '{col}' to numeric",
                    details={"col": col, "new_nulls": coerced})
    return df


def cast_categorical_cols(
    df: pd.DataFrame,
    cols: list[str],
    order: list[str] | None,
    logger: logging.Logger,
    tlog: TransformationLog,
) -> pd.DataFrame:
    """Cast specified columns to ordered (or unordered) pandas Categorical."""
    for col in cols:
        if col not in df.columns:
            continue
        ordered = order is not None
        df[col] = pd.Categorical(df[col], categories=order, ordered=ordered)
        logger.info(f"cast_categorical: '{col}' → Categorical(ordered={ordered})")
        tlog.record("cast_categorical", f"Cast '{col}' to Categorical",
                    details={"col": col, "ordered": ordered, "categories": order})
    return df


# ── Text standardisation ─────────────────────────────────────────────────────

def standardise_text_col(
    df: pd.DataFrame,
    col: str,
    case: str = "title",
) -> pd.DataFrame:
    """
    Normalise a string column:
    strip whitespace, normalise unicode, apply case.
    case: 'title' | 'upper' | 'lower' | 'none'
    Silently skips columns that are not string/object dtype.
    """
    if col not in df.columns:
        return df
    # Only apply to object/string columns — skip numeric columns
    if not pd.api.types.is_object_dtype(df[col]) and not pd.api.types.is_string_dtype(df[col]):
        return df
    s = df[col].astype(str).str.strip()
    s = s.apply(lambda x: unicodedata.normalize("NFKC", x))
    s = s.mask(s.str.lower().isin(TEXT_NULL_TOKENS | {"none"}), np.nan)
    if case == "title":
        s = s.str.title()
        # Repair common title-casing damage on apostrophes, acronyms, and roman numerals.
        s = s.str.replace(r"([A-Za-z])'S\b", r"\1's", regex=True)
        s = s.str.replace(r"\bIi\b", "II", regex=True)
        s = s.str.replace(r"\bIii\b", "III", regex=True)
        s = s.str.replace(r"\bIv\b", "IV", regex=True)
        s = s.str.replace(r"\bNec\b", "NEC", regex=True)
        s = s.str.replace(r"\bNfd\b", "NFD", regex=True)
        s = s.str.replace(r"\bIct\b", "ICT", regex=True)
        s = s.str.replace(r"\bVet\b", "VET", regex=True)
        s = s.str.replace(r"\bAqf\b", "AQF", regex=True)
        s = s.str.replace(r"\bAnzsco\b", "ANZSCO", regex=True)
    elif case == "upper":
        s = s.str.upper()
    elif case == "lower":
        s = s.str.lower()
    df[col] = s
    return df


def apply_value_map(
    df: pd.DataFrame,
    col: str,
    mapping: dict,
    logger: logging.Logger,
    tlog: TransformationLog,
) -> pd.DataFrame:
    """
    Replace values in `col` using `mapping` dict.
    Values not in the map are left unchanged — not silently dropped.
    Logs any values found that are NOT covered by the map.
    """
    if col not in df.columns:
        return df
    unique_raw = set(df[col].dropna().unique())
    unmapped = unique_raw - set(mapping.keys())
    if unmapped:
        logger.warning(f"apply_value_map '{col}': {len(unmapped)} unmapped values "
                       f"(e.g. {list(unmapped)[:5]}) — left as-is")
    df[col] = df[col].map(lambda v: mapping.get(v, v))
    tlog.record("apply_value_map", f"Standardised values in '{col}'",
                details={"col": col, "unmapped_count": len(unmapped),
                         "unmapped_samples": list(unmapped)[:10]})
    return df


# ── Missing value handling ────────────────────────────────────────────────────

def report_missing(df: pd.DataFrame, logger: logging.Logger) -> pd.Series:
    """Log and return per-column missing value fractions."""
    miss = df.isnull().mean().sort_values(ascending=False)
    high = miss[miss > 0]
    if not high.empty:
        logger.info("Missing value summary (non-zero columns):\n" +
                    high.to_string())
    return miss


def impute_with_median(
    df: pd.DataFrame,
    cols: list[str],
    logger: logging.Logger,
    tlog: TransformationLog,
) -> pd.DataFrame:
    """Fill numeric NaN with column median (robust to outliers)."""
    for col in cols:
        if col not in df.columns or not pd.api.types.is_numeric_dtype(df[col]):
            continue
        n_miss = df[col].isna().sum()
        if n_miss == 0:
            continue
        med = df[col].median()
        df[col] = df[col].fillna(med)
        logger.info(f"impute_median: '{col}' — {n_miss} values → median {med:.2f}")
        tlog.record("impute_median",
                    f"Imputed {n_miss} missing values in '{col}' with median",
                    details={"col": col, "n_imputed": int(n_miss), "value": float(med)})
    return df


def drop_rows_missing_key(
    df: pd.DataFrame,
    key_cols: list[str],
    logger: logging.Logger,
    tlog: TransformationLog,
) -> pd.DataFrame:
    """Drop rows where any key column is null — these rows cannot be joined."""
    r0 = len(df)
    df = df.dropna(subset=key_cols)
    removed = r0 - len(df)
    if removed:
        logger.warning(f"drop_missing_key: {removed} rows dropped "
                       f"(null in {key_cols})")
    tlog.record("drop_missing_key",
                f"Dropped {removed} rows with null key columns {key_cols}",
                r0, len(df), details={"key_cols": key_cols, "removed": removed})
    return df


# ── Outlier handling ─────────────────────────────────────────────────────────

def flag_outliers_iqr(
    df: pd.DataFrame,
    col: str,
    k: float = 3.0,
    logger: logging.Logger = None,
    tlog: TransformationLog = None,
) -> pd.DataFrame:
    """
    Add a boolean flag column `{col}_outlier_flag` using the k×IQR rule.
    Does NOT remove values — flags them for downstream decision-making.
    """
    if col not in df.columns or not pd.api.types.is_numeric_dtype(df[col]):
        return df
    q1 = df[col].quantile(0.25)
    q3 = df[col].quantile(0.75)
    iqr = q3 - q1
    lower, upper = q1 - k * iqr, q3 + k * iqr
    flag_col = f"{col}_outlier_flag"
    mask = df[col].notna()
    flagged = pd.Series(pd.NA, index=df.index, dtype="boolean")
    flagged.loc[mask] = ~df.loc[mask, col].between(lower, upper)
    df[flag_col] = flagged
    n_flagged = int(flagged.fillna(False).sum())
    if logger:
        logger.info(f"flag_outliers: '{col}' — {n_flagged} rows flagged "
                    f"(bounds [{lower:.2f}, {upper:.2f}], k={k})")
    if tlog:
        tlog.record("flag_outliers",
                    f"Flagged outliers in '{col}' using {k}×IQR",
                    details={"col": col, "lower": lower, "upper": upper,
                             "n_flagged": int(n_flagged)})
    return df


# ── ANZSCO utilities ─────────────────────────────────────────────────────────

def normalise_anzsco_title_series(series: pd.Series) -> pd.Series:
    """
    Normalise occupation titles for ANZSCO matching.
    Removes title-index suffix markers, country tags, punctuation noise,
    and standardises whitespace/case so reference titles and source titles
    can be matched safely.
    """
    s = series.astype("string").fillna("").str.strip()
    s = s.str.normalize("NFKC")
    s = s.str.replace("&", " and ", regex=False)
    s = s.str.replace(r"\s*\(([PASN])\)\s*$", "", regex=True)
    s = s.str.replace(r"\s*\((Aus|NZ)\)", "", regex=True)
    s = s.str.replace(r"[’`]", "'", regex=True)
    s = s.str.lower()
    s = s.str.replace(r"[^\w\s]", " ", regex=True)
    s = s.str.replace(r"\b(aus|nz)\b", " ", regex=True)
    s = s.str.replace(r"\s+", " ", regex=True).str.strip()
    return s.mask(s.eq(""), pd.NA)


def _anzsco_payload_columns(lookup: pd.DataFrame) -> dict[str, str]:
    """
    Return the lookup columns that should flow into downstream datasets.
    Keys are columns present in the lookup; values are the final output names.
    """
    payload: dict[str, str] = {}
    if "anzsco_code" in lookup.columns:
        payload["anzsco_code"] = "anzsco_code"
    if "preferred_occupation_title" in lookup.columns:
        payload["preferred_occupation_title"] = "anzsco_occupation_title"
    elif "occupation_title" in lookup.columns:
        payload["occupation_title"] = "anzsco_occupation_title"
    if "major_group_code" in lookup.columns:
        payload["major_group_code"] = "anzsco_major_group_code"
    if "major_group_label" in lookup.columns:
        payload["major_group_label"] = "anzsco_major_group_label"
    if "sub_major_group_code" in lookup.columns:
        payload["sub_major_group_code"] = "anzsco_sub_major_group_code"
    if "minor_group_code" in lookup.columns:
        payload["minor_group_code"] = "anzsco_minor_group_code"
    if "unit_group_code" in lookup.columns:
        payload["unit_group_code"] = "anzsco_unit_group_code"
    return payload


def build_anzsco_lookup(ref_df: pd.DataFrame) -> pd.DataFrame:
    """
    Build a lookup table mapping normalised occupation title → ANZSCO metadata.
    Expects at minimum 'anzsco_code' and 'occupation_title'. If the reference
    also has hierarchy columns or a preferred occupation title, they will be
    carried into the lookup for downstream enrichment.
    """
    if "anzsco_code" not in ref_df.columns:
        raise KeyError("ANZSCO lookup requires an 'anzsco_code' column")

    title_col = None
    for candidate in ("occupation_title", "title", "preferred_occupation_title"):
        if candidate in ref_df.columns:
            title_col = candidate
            break
    if title_col is None:
        raise KeyError("ANZSCO lookup requires an occupation title column")

    keep_cols = [title_col, "anzsco_code"]
    keep_cols.extend(
        c for c in [
            "preferred_occupation_title",
            "major_group_code",
            "major_group_label",
            "sub_major_group_code",
            "minor_group_code",
            "unit_group_code",
        ]
        if c in ref_df.columns
    )
    lookup = ref_df[keep_cols].copy()
    if title_col != "occupation_title":
        lookup = lookup.rename(columns={title_col: "occupation_title"})

    lookup["normalised_title"] = normalise_anzsco_title_series(lookup["occupation_title"])
    lookup = lookup.dropna(subset=["normalised_title", "anzsco_code"]).copy()

    ambiguous_titles = (
        lookup.groupby("normalised_title")["anzsco_code"]
        .nunique()
        .loc[lambda s: s > 1]
        .index
    )
    if len(ambiguous_titles):
        lookup = lookup[~lookup["normalised_title"].isin(ambiguous_titles)].copy()

    return lookup.drop_duplicates("normalised_title")


def exact_match_anzsco(
    df: pd.DataFrame,
    title_col: str,
    lookup: pd.DataFrame,
    logger: logging.Logger,
    tlog: TransformationLog,
) -> pd.DataFrame:
    """
    Exact (normalised) join of `title_col` in `df` to the ANZSCO lookup.
    Adds matched ANZSCO metadata columns while preserving unmatched rows.
    """
    if title_col not in df.columns:
        return df

    payload = _anzsco_payload_columns(lookup)
    lookup_index = lookup.set_index("normalised_title")
    norm = normalise_anzsco_title_series(df[title_col])
    matched_rows = lookup_index.reindex(norm.fillna("__missing__").tolist())

    for src_col, final_col in payload.items():
        if src_col in matched_rows.columns:
            df[f"{final_col}_matched"] = matched_rows[src_col].to_numpy()

    match_mask = pd.Series(False, index=df.index)
    if "anzsco_code" in payload:
        match_mask = df["anzsco_code_matched"].notna()

    df["anzsco_match_method_matched"] = pd.Series(pd.NA, index=df.index, dtype="object")
    df["anzsco_match_score_matched"] = pd.Series(pd.NA, index=df.index, dtype="Float64")
    df.loc[match_mask, "anzsco_match_method_matched"] = "exact"
    df.loc[match_mask, "anzsco_match_score_matched"] = 100.0

    match_rate = match_mask.mean()
    logger.info(f"exact_match_anzsco: {match_rate:.1%} of '{title_col}' matched "
                f"to ANZSCO reference titles")
    tlog.record("exact_match_anzsco",
                f"Exact ANZSCO lookup on '{title_col}'",
                details={"match_rate": float(match_rate),
                         "n_matched": int(match_mask.sum()),
                         "n_unmatched": int((~match_mask).sum())})
    return df


def fuzzy_match_anzsco(
    df: pd.DataFrame,
    title_col: str,
    lookup: pd.DataFrame,
    threshold: int,
    logger: logging.Logger,
    tlog: TransformationLog,
) -> pd.DataFrame:
    """
    Fuzzy-match `title_col` → ANZSCO code using rapidfuzz token_sort_ratio.
    Adds fuzzy ANZSCO metadata columns.
    Only rows where `anzsco_code_matched` is already NaN are attempted.
    Requires: pip install rapidfuzz
    """
    try:
        from rapidfuzz import process as rfp, fuzz
    except ImportError:
        logger.warning("rapidfuzz not installed — skipping fuzzy ANZSCO matching. "
                       "Run: pip install rapidfuzz")
        return df

    if title_col not in df.columns:
        return df

    payload = _anzsco_payload_columns(lookup)
    lookup_index = lookup.set_index("normalised_title")
    candidates = lookup["normalised_title"].tolist()
    norm = normalise_anzsco_title_series(df[title_col])
    blocked_mask = norm.fillna("").str.contains(r"\bunknown\b|\bnfd\b", regex=True)
    needs_match = df["anzsco_code_matched"].isna() & norm.notna() & ~blocked_mask

    for final_col in payload.values():
        df[f"{final_col}_fuzzy"] = pd.Series(pd.NA, index=df.index, dtype="object")
    df["anzsco_match_method_fuzzy"] = pd.Series(pd.NA, index=df.index, dtype="object")
    df["anzsco_match_score_fuzzy"] = pd.Series(pd.NA, index=df.index, dtype="Float64")

    matched = 0
    for idx, val in norm.loc[needs_match].items():
        match = rfp.extractOne(val, candidates, scorer=fuzz.token_sort_ratio)
        score = float(match[1]) if match else 0.0
        df.at[idx, "anzsco_match_score_fuzzy"] = score
        if not match or score < threshold:
            continue
        lookup_row = lookup_index.loc[match[0]]
        for src_col, final_col in payload.items():
            df.at[idx, f"{final_col}_fuzzy"] = lookup_row[src_col]
        df.at[idx, "anzsco_match_method_fuzzy"] = "fuzzy"
        matched += 1

    logger.info(f"fuzzy_match_anzsco: {matched}/{needs_match.sum()} additional "
                f"matches at threshold {threshold}")
    tlog.record("fuzzy_match_anzsco",
                f"Fuzzy ANZSCO lookup on '{title_col}'",
                details={"threshold": threshold,
                         "additional_matches": matched,
                         "total_attempted": int(needs_match.sum()),
                         "blocked_rows": int(blocked_mask.sum())})
    return df


def merge_anzsco_cols(
    df: pd.DataFrame,
    logger: logging.Logger,
    tlog: TransformationLog,
) -> pd.DataFrame:
    """
    Combine exact and fuzzy match columns into final ANZSCO enrichment columns.
    Priority: exact > fuzzy. Drops intermediate match columns.
    """
    merge_specs = [
        ("anzsco_code", "anzsco_code_matched", "anzsco_code_fuzzy"),
        ("anzsco_occupation_title", "anzsco_occupation_title_matched", "anzsco_occupation_title_fuzzy"),
        ("anzsco_major_group_code", "anzsco_major_group_code_matched", "anzsco_major_group_code_fuzzy"),
        ("anzsco_major_group_label", "anzsco_major_group_label_matched", "anzsco_major_group_label_fuzzy"),
        ("anzsco_sub_major_group_code", "anzsco_sub_major_group_code_matched", "anzsco_sub_major_group_code_fuzzy"),
        ("anzsco_minor_group_code", "anzsco_minor_group_code_matched", "anzsco_minor_group_code_fuzzy"),
        ("anzsco_unit_group_code", "anzsco_unit_group_code_matched", "anzsco_unit_group_code_fuzzy"),
        ("anzsco_match_method", "anzsco_match_method_matched", "anzsco_match_method_fuzzy"),
        ("anzsco_match_score", "anzsco_match_score_matched", "anzsco_match_score_fuzzy"),
    ]

    if not any(exact in df.columns or fuzzy in df.columns for _, exact, fuzzy in merge_specs):
        return df

    for final_col, exact_col, fuzzy_col in merge_specs:
        if exact_col not in df.columns and fuzzy_col not in df.columns:
            continue
        if exact_col in df.columns:
            df[final_col] = df[exact_col]
        else:
            df[final_col] = pd.Series(pd.NA, index=df.index)
        if fuzzy_col in df.columns:
            df[final_col] = df[final_col].fillna(df[fuzzy_col])

    for code_col in [
        "anzsco_code",
        "anzsco_major_group_code",
        "anzsco_sub_major_group_code",
        "anzsco_minor_group_code",
        "anzsco_unit_group_code",
    ]:
        if code_col in df.columns:
            df[code_col] = pd.to_numeric(df[code_col], errors="coerce").astype("Int64")
    if "anzsco_match_score" in df.columns:
        df["anzsco_match_score"] = pd.to_numeric(df["anzsco_match_score"], errors="coerce").astype("Float64")

    n_filled = df["anzsco_code"].notna().sum()
    logger.info(f"merge_anzsco_cols: {n_filled}/{len(df)} rows have anzsco_code")
    tlog.record("merge_anzsco_cols",
                "Merged exact + fuzzy ANZSCO match outputs",
                details={"n_with_code": int(n_filled),
                         "n_without_code": int(df["anzsco_code"].isna().sum())})

    drop_cols = [
        c for c in df.columns
        if c.endswith("_matched") or c.endswith("_fuzzy")
    ]
    return df.drop(columns=drop_cols)


# ── Wide → long (melt) helper ────────────────────────────────────────────────

def melt_timeseries(
    df: pd.DataFrame,
    id_vars: list[str],
    value_name: str,
    var_name: str = "year",
    logger: logging.Logger = None,
) -> pd.DataFrame:
    """
    Melt a wide timeseries DataFrame (year columns → rows).
    Year columns are detected as any column whose name is numeric.
    """
    year_cols = [c for c in df.columns if str(c).strip().isdigit()]
    non_year  = [c for c in df.columns if c not in year_cols]
    id_use    = [c for c in id_vars if c in non_year]
    long      = df.melt(id_vars=id_use, value_vars=year_cols,
                        var_name=var_name, value_name=value_name)
    long[var_name] = pd.to_numeric(long[var_name], errors="coerce")
    if logger:
        logger.info(f"melt_timeseries: {df.shape} → {long.shape} "
                    f"({len(year_cols)} year columns melted)")
    return long


# ── Validation ───────────────────────────────────────────────────────────────

def validate_dataset(
    df: pd.DataFrame,
    rules: dict,
    dataset_name: str,
    logger: logging.Logger,
) -> list[str]:
    """
    Apply validation rules and return a list of violation messages.
    Rules format: {col: (dtype_str, nullable, min_val, max_val, allowed_vals)}
    """
    issues: list[str] = []

    for col, (dtype_str, nullable, min_val, max_val, allowed) in rules.items():
        if col not in df.columns:
            issues.append(f"[MISSING COL] '{col}' not found in {dataset_name}")
            continue

        series = df[col]

        # Nullability
        n_null = series.isna().sum()
        if not nullable and n_null > 0:
            issues.append(f"[NON-NULLABLE] '{col}': {n_null} null values found")

        # Numeric range
        if min_val is not None and pd.api.types.is_numeric_dtype(series):
            n_below = (series.dropna() < min_val).sum()
            if n_below:
                issues.append(f"[RANGE] '{col}': {n_below} values below min={min_val}")
        if max_val is not None and pd.api.types.is_numeric_dtype(series):
            n_above = (series.dropna() > max_val).sum()
            if n_above:
                issues.append(f"[RANGE] '{col}': {n_above} values above max={max_val}")

        # Allowed values
        if allowed is not None:
            bad_vals = set(series.dropna().unique()) - set(allowed)
            if bad_vals:
                issues.append(f"[DOMAIN] '{col}': unexpected values {bad_vals}")

    if issues:
        logger.warning(f"Validation found {len(issues)} issues in {dataset_name}:")
        for msg in issues:
            logger.warning(f"  {msg}")
    else:
        logger.info(f"Validation passed for {dataset_name} — no issues found")

    return issues


# ── Output ────────────────────────────────────────────────────────────────────

def save_parquet(
    df: pd.DataFrame,
    path: Path,
    logger: logging.Logger,
    tlog: TransformationLog,
) -> None:
    """Save DataFrame to parquet with string-typed categoricals."""
    df = df.copy()
    # Cast ordered categoricals to string for serialisation
    for col in df.select_dtypes(include="category").columns:
        df[col] = df[col].astype(str).replace("nan", pd.NA)
    # Cast any object columns that still have mixed types to string
    for col in df.select_dtypes(include="object").columns:
        try:
            pd.to_numeric(df[col])
        except (ValueError, TypeError):
            df[col] = df[col].astype(str).replace({"nan": pd.NA, "None": pd.NA, "<NA>": pd.NA})
    df.to_parquet(path, index=False, engine="pyarrow")
    size_kb = path.stat().st_size / 1024
    logger.info(f"Saved → {path.name}  ({df.shape[0]:,} rows × {df.shape[1]} cols, "
                f"{size_kb:.1f} KB)")
    tlog.record("save_parquet",
                f"Written to {path}",
                rows_after=len(df), cols_after=df.shape[1],
                details={"path": str(path), "size_kb": round(size_kb, 1)})


# ── Excel multi-row header parser ─────────────────────────────────────────────

def read_excel_with_dynamic_header(
    path: Path,
    sheet_name: str,
    anchor: str,
    skiprows_fallback: int = 0,
    **read_kwargs,
) -> pd.DataFrame:
    """
    Read an Excel sheet where the real header row is not row 0.
    Detects the header row by scanning for `anchor` string.
    Falls back to `skiprows_fallback` if anchor not found.
    """
    # First pass — read raw to find header row
    raw = pd.read_excel(path, sheet_name=sheet_name, header=None,
                        engine="openpyxl")
    try:
        header_idx = find_header_row(raw, anchor)
    except ValueError:
        header_idx = skiprows_fallback

    # Second pass — read with correct header
    df = pd.read_excel(path, sheet_name=sheet_name,
                       header=header_idx, engine="openpyxl", **read_kwargs)
    return df
