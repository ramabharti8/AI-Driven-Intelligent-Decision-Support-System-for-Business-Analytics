"""Customer churn prediction and the retention decision it supports.

Definition (time-based, so there is no leakage from the future):
  cutoff     = last date in the data minus 90 days
  features   = behaviour of each customer up to the cutoff only
  label      = 1 (churned) if the customer, active before the cutoff,
               places no order in the 90 days after it

Three models are compared with 5-fold stratified cross-validation on ROC-AUC.
The winner is refit, checked on a 20% hold-out, and then scored on every
customer using all data, which gives the probability that each customer will
not order in the next 90 days.
"""
from __future__ import annotations

import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, confusion_matrix, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from ml_engine import data_engine

WINDOW_DAYS = 90
MODEL_DIR = os.path.join(data_engine.BASE_DIR, "saved_models")

FEATURES = {
    "recency_days": "Days since last order",
    "frequency": "Number of orders",
    "monetary": "Total spend",
    "avg_order_value": "Average order value",
    "tenure_days": "Days since first order",
    "orders_last_90d": "Orders in the last 90 days",
    "spend_last_90d": "Spend in the last 90 days",
    "distinct_products": "Distinct products bought",
    "avg_days_between_orders": "Average days between orders",
    "is_uk": "Based in the UK",
}


def build_features(inv: pd.DataFrame, lines: pd.DataFrame, asof: pd.Timestamp) -> pd.DataFrame:
    inv = inv[inv["InvoiceDate"] < asof]
    lines = lines[lines["InvoiceDate"] < asof]
    g = inv.groupby("CustomerID")
    f = pd.DataFrame({
        "recency_days": (asof - g["InvoiceDate"].max()).dt.days,
        "frequency": g["InvoiceNo"].nunique(),
        "monetary": g["Revenue"].sum(),
        "tenure_days": (asof - g["InvoiceDate"].min()).dt.days,
        "is_uk": (g["Country"].first() == "United Kingdom").astype(int),
    })
    f["avg_order_value"] = f["monetary"] / f["frequency"]
    recent = inv[inv["InvoiceDate"] >= asof - pd.Timedelta(days=WINDOW_DAYS)].groupby("CustomerID")
    f["orders_last_90d"] = recent["InvoiceNo"].nunique().reindex(f.index).fillna(0)
    f["spend_last_90d"] = recent["Revenue"].sum().reindex(f.index).fillna(0)
    f["distinct_products"] = lines.groupby("CustomerID")["StockCode"].nunique().reindex(f.index).fillna(0)
    span = (g["InvoiceDate"].max() - g["InvoiceDate"].min()).dt.days
    f["avg_days_between_orders"] = np.where(f["frequency"] > 1, span / (f["frequency"] - 1).clip(lower=1), f["tenure_days"])
    return f[list(FEATURES)]


def _models() -> dict:
    return {
        "logistic_regression": make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, class_weight="balanced")),
        "random_forest": RandomForestClassifier(n_estimators=300, min_samples_leaf=5, class_weight="balanced",
                                                random_state=42, n_jobs=-1),
        "gradient_boosting": HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_leaf_nodes=15,
                                                            class_weight="balanced", random_state=42),
    }


@data_engine.computed_once("churn", version=1)
def run() -> dict:
    inv = data_engine.invoices()
    lines = data_engine.transactions()
    ref = data_engine.reference_date()
    cutoff = ref - pd.Timedelta(days=WINDOW_DAYS)

    X = build_features(inv, lines, cutoff)
    after = set(inv.loc[inv["InvoiceDate"] >= cutoff, "CustomerID"])
    y = pd.Series([0 if c in after else 1 for c in X.index], index=X.index, name="churned")

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    comparison = []
    for name, model in _models().items():
        s = cross_validate(model, X, y, cv=cv, scoring=["roc_auc", "average_precision", "f1", "precision", "recall"])
        comparison.append({
            "algorithm": name,
            "roc_auc": round(float(s["test_roc_auc"].mean()), 3),
            "roc_auc_std": round(float(s["test_roc_auc"].std()), 3),
            "pr_auc": round(float(s["test_average_precision"].mean()), 3),
            "f1": round(float(s["test_f1"].mean()), 3),
            "precision": round(float(s["test_precision"].mean()), 3),
            "recall": round(float(s["test_recall"].mean()), 3),
        })
    comparison.sort(key=lambda r: r["roc_auc"], reverse=True)
    best = comparison[0]["algorithm"]

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    holdout_model = clone(_models()[best]).fit(X_tr, y_tr)
    p_te = holdout_model.predict_proba(X_te)[:, 1]
    pred_te = (p_te >= 0.5).astype(int)
    perm = permutation_importance(holdout_model, X_te, y_te, scoring="roc_auc", n_repeats=5, random_state=42)
    importance = sorted(
        [{"feature": f, "label": FEATURES[f], "importance": round(float(v), 4)}
         for f, v in zip(X.columns, perm.importances_mean)],
        key=lambda d: d["importance"], reverse=True)
    holdout = {
        "roc_auc": round(float(roc_auc_score(y_te, p_te)), 3),
        "pr_auc": round(float(average_precision_score(y_te, p_te)), 3),
        "precision": round(float(precision_score(y_te, pred_te)), 3),
        "recall": round(float(recall_score(y_te, pred_te)), 3),
        "f1": round(float(f1_score(y_te, pred_te)), 3),
        "confusion_matrix": confusion_matrix(y_te, pred_te).tolist(),
        "test_customers": int(len(y_te)),
    }

    final = clone(_models()[best]).fit(X, y)
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump({"model": final, "features": list(FEATURES)}, os.path.join(MODEL_DIR, "churn_model.joblib"))

    now = build_features(inv, lines, ref)
    proba = final.predict_proba(now)[:, 1]
    # Expected revenue in the next 90 days if the customer stays: their spend rate
    # over the past year, scaled to a quarter.
    year_spend = inv[inv["InvoiceDate"] >= ref - pd.Timedelta(days=365)].groupby("CustomerID")["Revenue"].sum()
    quarter_value = (year_spend.reindex(now.index).fillna(0) / 4).round(2)
    scored = pd.DataFrame({"churn_probability": proba.round(4), "quarter_value": quarter_value,
                           "recency_days": now["recency_days"], "frequency": now["frequency"],
                           "monetary": now["monetary"].round(2)}, index=now.index)
    scored["expected_loss"] = (scored["churn_probability"] * scored["quarter_value"]).round(2)

    result = {
        "definition": f"Churned = no order in the {WINDOW_DAYS} days after {cutoff.date()} "
                      f"(customers active before that date).",
        "cutoff": str(cutoff.date()),
        "training_customers": int(len(X)),
        "churn_rate": round(float(y.mean() * 100), 1),
        "model_used": best,
        "comparison": comparison,
        "holdout": holdout,
        "feature_importance": importance,
        "currency": data_engine.CURRENCY,
    }
    with open(os.path.join(MODEL_DIR, "churn_metrics.json"), "w") as fh:
        json.dump(result, fh, indent=2)
    result["_scored"] = scored
    return result


def public() -> dict:
    return {k: v for k, v in run().items() if not k.startswith("_")}


SAVABLE_DAYS = 180


def _savable() -> pd.DataFrame:
    """Customers who still have a realistic chance of being retained.
    Someone silent for more than SAVABLE_DAYS is a win-back target, a different
    (cheaper) campaign, so they are left out of the retention list."""
    s = run()["_scored"]
    return s[s["recency_days"] <= SAVABLE_DAYS]


def at_risk(limit: int = 25) -> list[dict]:
    from ml_engine import segmentation
    seg = segmentation.run()["customer_segment"]
    s = _savable().sort_values("expected_loss", ascending=False).head(limit)
    return [{"customer_id": int(cid), "churn_probability": float(r.churn_probability),
             "quarter_value": float(r.quarter_value), "expected_loss": float(r.expected_loss),
             "recency_days": int(r.recency_days), "orders": int(r.frequency), "lifetime_spend": float(r.monetary),
             "segment": seg.get(cid, "")} for cid, r in s.iterrows()]


def retention_plan(contact_cost: float = 5.0, save_rate: float = 0.20, top_n: int | None = None) -> dict:
    """What-if: contact the N customers with the highest expected loss.

    expected revenue saved = sum(churn probability x quarter value) x save rate
    cost                   = N x contact cost
    The sweep finds the N with the highest net gain.
    """
    s = _savable().sort_values("expected_loss", ascending=False)
    saved_cum = (s["expected_loss"] * save_rate).cumsum().to_numpy()
    n = np.arange(1, len(s) + 1)
    net = saved_cum - n * contact_cost
    best_n = int(n[int(np.argmax(net))])
    chosen = best_n if top_n is None else max(1, min(int(top_n), len(s)))
    i = chosen - 1
    steps = sorted({10, 25, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000, best_n} & set(range(1, len(s) + 1)))
    curve = [{"n": int(k), "saved": round(float(saved_cum[k - 1])), "cost": round(k * contact_cost),
              "net": round(float(net[k - 1]))} for k in steps]
    return {
        "inputs": {"contact_cost": contact_cost, "save_rate": save_rate, "top_n": chosen},
        "recommended_n": best_n,
        "customers_contacted": chosen,
        "expected_revenue_saved": round(float(saved_cum[i])),
        "campaign_cost": round(chosen * contact_cost),
        "net_gain": round(float(net[i])),
        "roi_pct": round(float(net[i] / (chosen * contact_cost) * 100), 1) if contact_cost else None,
        "curve": curve,
        "currency": data_engine.CURRENCY,
        "eligible_customers": int(len(s)),
        "assumptions": "Save rate and contact cost are business assumptions you set; the churn probabilities "
                       "and customer values come from the model and the data. Only customers who ordered in the "
                       f"last {SAVABLE_DAYS} days are included.",
    }
