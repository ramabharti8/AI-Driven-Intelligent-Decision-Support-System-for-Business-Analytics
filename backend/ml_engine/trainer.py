"""Train a model on any uploaded table (generic ML workbench).

Improvements over the first version:
  - One scikit-learn Pipeline holds imputation, one-hot encoding, scaling and
    the model, so the saved file can predict on raw input (the old version
    saved only the model and predicted on unscaled, unencoded values).
  - A leakage guard drops ID-like columns and columns that almost perfectly
    determine the target (e.g. Revenue when predicting a revenue category),
    and reports what it dropped.
  - Metrics come from k-fold cross-validation (mean and std), plus a hold-out
    confusion matrix, instead of a single lucky split.
"""
from __future__ import annotations

import uuid
import warnings

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (GradientBoostingClassifier, GradientBoostingRegressor, RandomForestClassifier,
                              RandomForestRegressor)
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score, mean_absolute_error, mean_squared_error,
                             precision_score, r2_score, recall_score)
from sklearn.model_selection import KFold, StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

warnings.filterwarnings("ignore", category=UserWarning)

ALGORITHMS = {
    "linear_regression": "regression",
    "logistic_regression": "classification",
    "decision_tree": "both",
    "random_forest": "both",
    "gradient_boosting": "both",
    "svm": "both",
}


def _get_model(algorithm: str, task_type: str):
    models = {
        ("linear_regression", "regression"): LinearRegression(),
        ("logistic_regression", "classification"): LogisticRegression(max_iter=2000),
        ("decision_tree", "classification"): DecisionTreeClassifier(max_depth=8, random_state=42),
        ("decision_tree", "regression"): DecisionTreeRegressor(max_depth=8, random_state=42),
        ("random_forest", "classification"): RandomForestClassifier(n_estimators=200, random_state=42),
        ("random_forest", "regression"): RandomForestRegressor(n_estimators=200, random_state=42),
        ("gradient_boosting", "classification"): GradientBoostingClassifier(random_state=42),
        ("gradient_boosting", "regression"): GradientBoostingRegressor(random_state=42),
        ("svm", "classification"): SVC(kernel="rbf", random_state=42),
        ("svm", "regression"): SVR(kernel="rbf"),
    }
    if (algorithm, task_type) not in models:
        raise ValueError(f"{algorithm} does not support {task_type}")
    return models[(algorithm, task_type)]


def leakage_check(df: pd.DataFrame, target: str, task_type: str) -> tuple[list[str], list[dict]]:
    """Return (columns to keep, columns dropped with reasons)."""
    dropped, keep = [], []
    y = df[target]
    for col in df.columns:
        if col == target:
            continue
        s = df[col]
        n = len(s.dropna())
        if n == 0:
            dropped.append({"column": col, "reason": "empty"})
            continue
        if len(col) >= 4 and col.lower() in target.lower() and col.lower() != target.lower():
            dropped.append({"column": col, "reason": f"leakage: target '{target}' looks derived from it"})
            continue
        if pd.api.types.is_datetime64_any_dtype(s) or (s.dtype == object and _looks_like_date(s)):
            dropped.append({"column": col, "reason": "date (use derived features instead)"})
            continue
        uniq = s.nunique(dropna=True)
        id_name = col.lower().endswith(("id", "_no", "number")) or col.lower() == "id"
        if uniq == n and (s.dtype == object or id_name or (pd.api.types.is_integer_dtype(s) and s.is_monotonic_increasing)):
            dropped.append({"column": col, "reason": "identifier (every value unique)"})
            continue
        if s.dtype == object and uniq > 50 and uniq / n > 0.5:
            dropped.append({"column": col, "reason": "high-cardinality text"})
            continue
        # Near-perfect predictor of the target = leakage.
        if pd.api.types.is_numeric_dtype(s):
            if task_type == "regression" and pd.api.types.is_numeric_dtype(y):
                corr = abs(s.corr(y))
                if corr > 0.98:
                    dropped.append({"column": col, "reason": f"leakage: correlation {corr:.2f} with target"})
                    continue
            elif task_type == "classification":
                purity = _single_feature_purity(s, y)
                if purity > 0.97:
                    dropped.append({"column": col, "reason": f"leakage: alone predicts target {purity:.0%}"})
                    continue
        keep.append(col)
    return keep, dropped


def _looks_like_date(s: pd.Series) -> bool:
    sample = s.dropna().astype(str).head(20)
    if sample.empty or not sample.str.contains(r"\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4}").all():
        return False
    return pd.to_datetime(sample, errors="coerce").notna().all()


def _single_feature_purity(x: pd.Series, y: pd.Series) -> float:
    """Accuracy of a depth-3 tree using one numeric column (cross-validated)."""
    d = pd.DataFrame({"x": x, "y": y.astype(str)}).dropna()
    if d["y"].nunique() < 2 or len(d) < 10:
        return 0.0
    from sklearn.model_selection import cross_val_score
    folds = min(5, int(d["y"].value_counts().min()))
    if folds < 2:
        return 0.0
    return float(cross_val_score(DecisionTreeClassifier(max_depth=3, random_state=0), d[["x"]], d["y"], cv=folds).mean())


def build_pipeline(X: pd.DataFrame, algorithm: str, task_type: str) -> Pipeline:
    num = X.select_dtypes(include="number").columns.tolist()
    cat = [c for c in X.columns if c not in num]
    pre = ColumnTransformer([
        ("num", Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), num),
        ("cat", Pipeline([("impute", SimpleImputer(strategy="most_frequent")),
                          ("onehot", OneHotEncoder(handle_unknown="ignore", min_frequency=2))]), cat),
    ])
    return Pipeline([("prep", pre), ("model", _get_model(algorithm, task_type))])


def train_model(df: pd.DataFrame, target_column: str, algorithm: str = "random_forest",
                task_type: str = "classification", test_size: float = 0.2) -> dict:
    df = df.drop_duplicates().dropna(subset=[target_column]).copy()
    for c in df.select_dtypes(include="object").columns:
        df[c] = df[c].astype(str).str.strip()
    features, dropped = leakage_check(df, target_column, task_type)
    if not features:
        raise ValueError("No usable feature columns left after the leakage check.")
    X, y = df[features], df[target_column]
    if task_type == "classification":
        y = y.astype(str)

    pipe = build_pipeline(X, algorithm, task_type)
    n_splits = 5
    if task_type == "classification":
        n_splits = max(2, min(5, int(y.value_counts().min())))
        cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        scoring = {"accuracy": "accuracy", "precision": "precision_weighted", "recall": "recall_weighted",
                   "f1": "f1_weighted"}
    else:
        cv = KFold(n_splits=n_splits, shuffle=True, random_state=42)
        scoring = {"r2": "r2", "mae": "neg_mean_absolute_error", "rmse": "neg_root_mean_squared_error"}
    cvres = cross_validate(pipe, X, y, cv=cv, scoring=scoring)

    strat = y if task_type == "classification" and y.value_counts().min() >= 2 else None
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=test_size, random_state=42, stratify=strat)
    pipe.fit(X_tr, y_tr)
    y_pred = pipe.predict(X_te)

    result = {"job_id": str(uuid.uuid4())[:8], "algorithm": algorithm, "task_type": task_type,
              "target_column": target_column, "features_used": features, "dropped_columns": dropped,
              "cv_folds": n_splits, "training_samples": int(len(X_tr)), "testing_samples": int(len(X_te)),
              "total_rows": int(len(X))}
    if task_type == "classification":
        cvm = {k: (round(float(cvres[f"test_{k}"].mean()) * 100, 2), round(float(cvres[f"test_{k}"].std()) * 100, 2))
               for k in scoring}
        result.update({
            "accuracy": cvm["accuracy"][0], "accuracy_std": cvm["accuracy"][1],
            "precision": cvm["precision"][0], "recall": cvm["recall"][0], "f1_score": cvm["f1"][0],
            "holdout_accuracy": round(float(accuracy_score(y_te, y_pred)) * 100, 2),
            "holdout_f1": round(float(f1_score(y_te, y_pred, average="weighted", zero_division=0)) * 100, 2),
            "holdout_precision": round(float(precision_score(y_te, y_pred, average="weighted", zero_division=0)) * 100, 2),
            "holdout_recall": round(float(recall_score(y_te, y_pred, average="weighted", zero_division=0)) * 100, 2),
            "classes": sorted(y.unique().tolist()),
            "confusion_matrix": confusion_matrix(y_te, y_pred, labels=sorted(y.unique().tolist())).tolist(),
            "baseline_accuracy": round(float(y.value_counts(normalize=True).max()) * 100, 2),
            "mse": 0.0, "r2_score": 0.0,
        })
    else:
        r2m = float(cvres["test_r2"].mean())
        result.update({
            "r2_score": round(r2m, 4), "r2_std": round(float(cvres["test_r2"].std()), 4),
            "mae": round(float(-cvres["test_mae"].mean()), 4), "rmse": round(float(-cvres["test_rmse"].mean()), 4),
            "mse": round(float(mean_squared_error(y_te, y_pred)), 4),
            "holdout_mae": round(float(mean_absolute_error(y_te, y_pred)), 4),
            "holdout_r2": round(float(r2_score(y_te, y_pred)), 4),
            # Kept for the older UI cards: R2 shown as a percentage, never invented.
            "accuracy": round(max(0.0, r2m) * 100, 2), "precision": 0.0, "recall": 0.0, "f1_score": 0.0,
            "confusion_matrix": [],
        })

    perm = permutation_importance(pipe, X_te, y_te, n_repeats=5, random_state=42)
    imp = {f: round(float(v), 4) for f, v in zip(features, perm.importances_mean)}
    result["feature_importance"] = dict(sorted(imp.items(), key=lambda kv: kv[1], reverse=True))
    result["model_obj"] = pipe
    return result


def predict_one(pipe: Pipeline, features: list[str], input_data: dict) -> dict:
    row = pd.DataFrame([{f: input_data.get(f, np.nan) for f in features}])
    for c in row.columns:
        try:
            row[c] = pd.to_numeric(row[c])
        except (ValueError, TypeError):
            pass
    pred = pipe.predict(row)[0]
    out = {"prediction": pred.item() if hasattr(pred, "item") else pred}
    if hasattr(pipe, "predict_proba"):
        try:
            proba = pipe.predict_proba(row)[0]
            out["probability"] = {str(c): round(float(p), 4) for c, p in zip(pipe.classes_, proba)}
        except Exception:
            pass
    return out
