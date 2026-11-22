"""Checks that the analytics and models compute what they claim to."""
import os

import pandas as pd
import pytest

from ml_engine import churn, data_engine, forecast, segmentation, trainer

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pytestmark = pytest.mark.skipif(not os.path.exists(data_engine.DATA_PATH), reason="cleaned dataset not prepared")


def test_revenue_adds_up():
    lines = data_engine.transactions()
    k = data_engine.kpis()
    assert k["kpis"]["total_revenue"]["value"] == round(lines["Revenue"].sum())
    assert k["kpis"]["total_orders"]["value"] == lines["InvoiceNo"].nunique()
    assert (lines["Quantity"] > 0).all() and (lines["UnitPrice"] > 0).all()


def test_monthly_change_uses_complete_months_only():
    m = data_engine.monthly()
    assert not m["complete"].iloc[-1]  # Dec 2011 has only 9 days of data
    assert data_engine.kpis()["period"]["compare"] == "2011-11 vs 2011-10"


def test_forecast_beats_or_equals_naive_and_intervals_contain_forecast():
    f = forecast.run()
    maes = {m["model"]: m["mae"] for m in f["models"]}
    assert maes[f["model_used"]] <= maes["naive"]
    fc = f["forecast"]
    assert len(fc["predicted"]) == forecast.HORIZON
    assert all(lo <= p <= hi for lo, p, hi in zip(fc["lower"], fc["predicted"], fc["upper"]))


def test_segments_cover_every_customer_once_with_unique_names():
    s = segmentation.public()
    assert 4 <= s["k"] <= 6
    assert sum(x["customers"] for x in s["segments"]) == len(data_engine.rfm())
    names = [x["segment"] for x in s["segments"]]
    assert len(names) == len(set(names))


def test_churn_model_is_better_than_chance_and_uses_past_data_only():
    c = churn.public()
    assert c["holdout"]["roc_auc"] > 0.65
    inv = data_engine.invoices()
    cutoff = pd.Timestamp(c["cutoff"])
    X = churn.build_features(inv, data_engine.transactions(), cutoff)
    assert (X["recency_days"] >= 0).all()
    assert X.index.isin(inv.loc[inv["InvoiceDate"] < cutoff, "CustomerID"]).all()


def test_retention_recommendation_is_the_best_point():
    p = churn.retention_plan(contact_cost=10, save_rate=0.2)
    assert p["net_gain"] == max(pt["net"] for pt in p["curve"])
    assert p["campaign_cost"] == p["recommended_n"] * 10


def test_leakage_guard_drops_columns_that_define_the_target():
    df = pd.read_csv(os.path.join(BACKEND, "datasets", "sample_business_data.csv"))
    keep, dropped = trainer.leakage_check(df, "revenue_category", "classification")
    dropped_cols = {d["column"] for d in dropped}
    assert "Order_ID" in dropped_cols
    assert "Revenue" in dropped_cols
    assert "Revenue" not in keep


def test_pipeline_predicts_from_raw_input():
    df = pd.read_csv(os.path.join(BACKEND, "datasets", "sample_business_data.csv"))
    r = trainer.train_model(df, "revenue_category", "random_forest", "classification")
    row = df.iloc[0].to_dict()
    out = trainer.predict_one(r["model_obj"], r["features_used"], row)
    assert out["prediction"] in set(df["revenue_category"].astype(str))
    assert abs(sum(out["probability"].values()) - 1) < 1e-6
