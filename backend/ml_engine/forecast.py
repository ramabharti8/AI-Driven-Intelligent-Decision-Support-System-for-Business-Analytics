"""Weekly revenue forecasting with an honest backtest.

Three candidate models are compared on a rolling-origin backtest (each of the
last BACKTEST_WEEKS weeks is predicted using only the weeks before it):
  - naive:          next week = this week
  - moving_average: next week = mean of the last 4 weeks
  - ridge_lags:     Ridge regression on the last 4 weeks + a time trend
The model with the lowest backtest MAE is used for the forecast. Prediction
intervals come from that model's backtest errors (about 80% coverage), widened
with the square root of the horizon because errors compound.
"""
from __future__ import annotations


import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

from ml_engine import data_engine

LAGS = 4
BACKTEST_WEEKS = 12
HORIZON = 8
Z80 = 1.2816


def weekly_revenue() -> pd.Series:
    df = data_engine.transactions()
    s = df.set_index("InvoiceDate")["Revenue"].resample("W-SUN").sum()
    # Drop partial first and last weeks so they don't look like crashes.
    first, last = df["InvoiceDate"].min(), df["InvoiceDate"].max()
    if first.dayofweek != 0:
        s = s.iloc[1:]
    if last.dayofweek != 6:
        s = s.iloc[:-1]
    return s


def _features(history: np.ndarray, t: int) -> np.ndarray:
    return np.r_[history[t - LAGS:t][::-1], t]


def _predict_next(model: str, history: np.ndarray) -> float:
    if model == "naive":
        return float(history[-1])
    if model == "moving_average":
        return float(history[-LAGS:].mean())
    X = np.array([_features(history, t) for t in range(LAGS, len(history))])
    y = history[LAGS:]
    reg = Ridge(alpha=1.0).fit(X, y)
    return float(reg.predict(_features(np.r_[history, 0], len(history))[None, :])[0])


@data_engine.computed_once("forecast", version=1)
def run() -> dict:
    s = weekly_revenue()
    y = s.to_numpy(dtype=float)
    start = len(y) - BACKTEST_WEEKS
    results = {}
    for model in ("naive", "moving_average", "ridge_lags"):
        preds = np.array([_predict_next(model, y[:t]) for t in range(start, len(y))])
        actual = y[start:]
        err = actual - preds
        results[model] = {
            "mae": round(float(np.abs(err).mean())),
            "mape": round(float(np.mean(np.abs(err) / actual) * 100), 1),
            "errors": err,
            "preds": preds,
        }
    best = min(results, key=lambda m: results[m]["mae"])
    resid_sd = float(np.std(results[best]["errors"], ddof=1))

    history = y.copy()
    forecast = []
    for _ in range(HORIZON):
        nxt = max(0.0, _predict_next(best, history))
        forecast.append(nxt)
        history = np.r_[history, nxt]

    future_idx = pd.date_range(s.index[-1] + pd.Timedelta(days=7), periods=HORIZON, freq="W-SUN")
    lower = [max(0.0, f - Z80 * resid_sd * np.sqrt(h + 1)) for h, f in enumerate(forecast)]
    upper = [f + Z80 * resid_sd * np.sqrt(h + 1) for h, f in enumerate(forecast)]
    naive_mae = results["naive"]["mae"]

    return {
        "history": {"labels": [d.strftime("%d %b %Y") for d in s.index], "revenue": [round(v) for v in y]},
        "backtest": {
            "labels": [d.strftime("%d %b %Y") for d in s.index[start:]],
            "actual": [round(v) for v in y[start:]],
            "predicted": [round(v) for v in results[best]["preds"]],
        },
        "forecast": {
            "labels": [d.strftime("%d %b %Y") for d in future_idx],
            "predicted": [round(v) for v in forecast],
            "lower": [round(v) for v in lower],
            "upper": [round(v) for v in upper],
            "interval": "80%",
        },
        "model_used": best,
        "models": [{"model": m, "mae": r["mae"], "mape": r["mape"]} for m, r in results.items()],
        "improvement_vs_naive_pct": round((naive_mae - results[best]["mae"]) / naive_mae * 100, 1) if naive_mae else 0.0,
        "backtest_weeks": BACKTEST_WEEKS,
        "horizon_weeks": HORIZON,
        "currency": data_engine.CURRENCY,
        "note": "Only 12 months of history exist, so yearly seasonality (the Nov peak) cannot be learned; "
                "intervals are wide around the holiday season.",
    }
