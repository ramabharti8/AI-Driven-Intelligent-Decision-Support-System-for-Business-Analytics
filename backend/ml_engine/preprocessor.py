# ml_engine/preprocessor.py — Data preprocessing pipeline

import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, MinMaxScaler, StandardScaler
from sklearn.model_selection import train_test_split
import json


def preprocess_dataframe(df: pd.DataFrame, target_column: str) -> pd.DataFrame:
    """
    Full preprocessing pipeline:
    1. Remove duplicates
    2. Handle missing values
    3. Encode categorical columns
    4. (Normalization done inside trainer)
    """
    df = df.copy()

    # 1. Remove duplicates
    before = len(df)
    df = df.drop_duplicates()
    removed_dupes = before - len(df)

    # 2. Handle missing values
    for col in df.columns:
        if col == target_column:
            df = df.dropna(subset=[col])
            continue
        if pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].fillna(df[col].median())
        else:
            mode_val = df[col].mode()
            df[col] = df[col].fillna(mode_val[0] if len(mode_val) > 0 else "Unknown")

    # 3. Encode categorical columns (except target)
    for col in df.select_dtypes(include=["object"]).columns:
        if col == target_column:
            continue
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))

    return df


def get_preprocessing_stats(df_original: pd.DataFrame, df_processed: pd.DataFrame, target_column: str) -> dict:
    """Return a visual summary of preprocessing steps applied."""
    missing_before = int(df_original.isnull().sum().sum())
    missing_after  = int(df_processed.isnull().sum().sum())
    dupes_removed  = len(df_original) - len(df_processed)

    categorical_encoded = list(df_original.select_dtypes(include=["object"]).columns)
    if target_column in categorical_encoded:
        categorical_encoded.remove(target_column)

    return {
        "rows_before": len(df_original),
        "rows_after":  len(df_processed),
        "duplicates_removed": max(0, dupes_removed),
        "missing_before": missing_before,
        "missing_after":  missing_after,
        "columns_encoded": categorical_encoded,
        "encoding_method": "Label Encoding",
        "missing_strategy_numeric": "Median imputation",
        "missing_strategy_cat":    "Mode imputation",
        "steps": [
            {"step": "Remove Duplicates",       "status": "done", "detail": f"{max(0, dupes_removed)} rows removed"},
            {"step": "Handle Missing Values",   "status": "done", "detail": f"{missing_before} → {missing_after} missing"},
            {"step": "Encode Categorical",      "status": "done", "detail": f"{len(categorical_encoded)} columns encoded"},
            {"step": "Feature Ready",           "status": "done", "detail": "Data ready for training"},
        ],
    }


def run_preprocessing_api(file_path: str, target_column: str) -> dict:
    """Full preprocessing pipeline for API endpoint."""
    import os
    ext = os.path.splitext(file_path)[1].lower()
    df_orig = pd.read_csv(file_path) if ext == ".csv" else pd.read_excel(file_path)
    df_proc = preprocess_dataframe(df_orig, target_column)
    stats = get_preprocessing_stats(df_orig, df_proc, target_column)

    # Column types breakdown
    col_types = {}
    for col in df_orig.columns:
        col_types[col] = {
            "dtype": str(df_orig[col].dtype),
            "missing": int(df_orig[col].isna().sum()),
            "unique": int(df_orig[col].nunique()),
        }

    stats["column_types"] = col_types
    stats["columns"] = list(df_orig.columns)
    return stats
