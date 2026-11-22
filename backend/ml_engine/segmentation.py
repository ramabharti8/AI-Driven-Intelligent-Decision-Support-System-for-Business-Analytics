"""Customer segmentation: RFM features + K-Means, k (4-6) chosen by silhouette score.

Recency is how many days since the last order, Frequency is the number of
orders, Monetary is total spend. Frequency and Monetary are heavily skewed, so
they are log-transformed before scaling; otherwise a few wholesale buyers would
form clusters of their own.

Clusters are named from their centroids so the names are reproducible:
  recent + high value  -> Champions
  recent + lower value -> Promising
  lapsed + high value  -> At Risk (high value)
  lapsed + lower value -> Hibernating
"""
from __future__ import annotations


import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from ml_engine import data_engine

# At least 4 segments so marketing gets distinct groups to act on; silhouette picks among 4-6.
MIN_K = 4

ACTIONS = {
    "Champions": "Reward and retain: early access, loyalty perks, ask for referrals. Do not discount.",
    "Loyal": "Upsell premium ranges and keep them engaged with a loyalty programme.",
    "Promising": "Grow basket size: bundles, cross-sell, free-shipping thresholds.",
    "New / Occasional": "Onboarding series to drive the second order, the biggest drop-off point.",
    "At Risk (high value)": "Win back now: personal outreach and a targeted offer. Highest return on retention spend.",
    "Can't Lose Them": "Account-manager call: find out why they stopped before a competitor wins them.",
    "Hibernating": "Low-cost reactivation emails only; stop spending if they do not respond.",
    "Lost": "Exclude from paid campaigns; include only in occasional newsletters.",
}


def _matrix(r: pd.DataFrame) -> np.ndarray:
    X = np.column_stack([r["recency"], np.log1p(r["frequency"]), np.log1p(r["monetary"])])
    return StandardScaler().fit_transform(X)


NAME_LADDER = {
    (True, True): ["Champions", "Loyal"],
    (True, False): ["Promising", "New / Occasional"],
    (False, True): ["At Risk (high value)", "Can't Lose Them"],
    (False, False): ["Hibernating", "Lost"],
}


def _name_clusters(centroids: pd.DataFrame, overall: pd.DataFrame) -> dict[int, str]:
    """Compare each cluster's centroid with the median customer."""
    rec_cut = overall["recency"].median()
    mon_cut = overall["monetary"].median()
    freq_cut = overall["frequency"].median()
    value = centroids["monetary"].rank() + centroids["frequency"].rank()
    names, used = {}, {}
    for c in value.sort_values(ascending=False).index:
        recent = centroids.loc[c, "recency"] <= rec_cut
        high = centroids.loc[c, "monetary"] > mon_cut and centroids.loc[c, "frequency"] >= freq_cut
        ladder = NAME_LADDER[(bool(recent), bool(high))]
        i = used.get(ladder[0], 0)
        used[ladder[0]] = i + 1
        names[c] = ladder[i] if i < len(ladder) else f"{ladder[-1]} {i}"
    return names


@data_engine.computed_once("segments", version=1)
def run() -> dict:
    r = data_engine.rfm().copy()
    X = _matrix(r)
    rng = np.random.RandomState(42)
    sample = rng.choice(len(X), size=min(2000, len(X)), replace=False)
    scores = {}
    for k in range(MIN_K, 7):
        km = KMeans(n_clusters=k, n_init=10, random_state=42).fit(X)
        scores[k] = round(float(silhouette_score(X[sample], km.labels_[sample])), 3)
    best_k = max(scores, key=scores.get)
    km = KMeans(n_clusters=best_k, n_init=10, random_state=42).fit(X)
    r["cluster"] = km.labels_

    cent = r.groupby("cluster")[["recency", "frequency", "monetary"]].mean()
    names = _name_clusters(cent, r)
    r["segment"] = r["cluster"].map(names)

    total_rev = r["monetary"].sum()
    segs = []
    for name, g in r.groupby("segment"):
        segs.append({
            "segment": name,
            "customers": int(len(g)),
            "customer_share": round(len(g) / len(r) * 100, 1),
            "revenue": round(float(g["monetary"].sum())),
            "revenue_share": round(float(g["monetary"].sum() / total_rev * 100), 1),
            "avg_recency_days": round(float(g["recency"].mean())),
            "avg_orders": round(float(g["frequency"].mean()), 1),
            "avg_spend": round(float(g["monetary"].mean())),
            "action": ACTIONS.get(name, ""),
        })
    segs.sort(key=lambda s: s["revenue"], reverse=True)

    sample_pts = r.sample(n=min(600, len(r)), random_state=1)
    points = [{"recency": int(p.recency), "frequency": int(p.frequency), "monetary": round(float(p.monetary)),
               "segment": p.segment} for p in sample_pts.itertuples()]
    return {
        "k": best_k,
        "silhouette_by_k": scores,
        "segments": segs,
        "points": points,
        "customer_segment": r["segment"].to_dict(),
        "currency": data_engine.CURRENCY,
    }


def public() -> dict:
    out = dict(run())
    out.pop("customer_segment")
    return out
