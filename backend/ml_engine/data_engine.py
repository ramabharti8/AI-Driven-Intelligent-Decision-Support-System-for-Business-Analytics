"""Business analytics computed from the real transaction data.

Every number the dashboard shows comes from here, from the cleaned UCI Online
Retail data (see scripts/prepare_online_retail.py). Nothing is hardcoded or
random. Amounts are in GBP (the retailer is UK-based).
"""
from __future__ import annotations

import os
from functools import lru_cache

import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "datasets", "online_retail_clean.csv.gz")
CURRENCY = "GBP"


class DataNotReady(RuntimeError):
    """Raised when the cleaned dataset has not been prepared yet."""


@lru_cache(maxsize=1)
def transactions() -> pd.DataFrame:
    if not os.path.exists(DATA_PATH):
        raise DataNotReady(
            "online_retail_clean.csv.gz is missing. Run: "
            'python scripts/prepare_online_retail.py "Online Retail.xlsx"'
        )
    df = pd.read_csv(DATA_PATH, parse_dates=["InvoiceDate"], dtype={"InvoiceNo": str, "StockCode": str})
    df["Month"] = df["InvoiceDate"].dt.to_period("M")
    df["Date"] = df["InvoiceDate"].dt.normalize()
    return df


def reference_date() -> pd.Timestamp:
    """The day after the last transaction: 'today' for this dataset."""
    return transactions()["InvoiceDate"].max().normalize() + pd.Timedelta(days=1)


@lru_cache(maxsize=1)
def invoices() -> pd.DataFrame:
    """One row per invoice (order)."""
    df = transactions()
    return (
        df.groupby("InvoiceNo")
        .agg(CustomerID=("CustomerID", "first"), InvoiceDate=("InvoiceDate", "first"),
             Country=("Country", "first"), Revenue=("Revenue", "sum"), Items=("Quantity", "sum"),
             Lines=("StockCode", "count"))
        .reset_index()
        .assign(Month=lambda d: d["InvoiceDate"].dt.to_period("M"))
    )


def _complete_months() -> list[pd.Period]:
    """Months fully covered by the data (the last month is usually partial)."""
    df = transactions()
    months = sorted(df["Month"].unique())
    last_day = df["InvoiceDate"].max()
    if last_day.day < last_day.days_in_month - 1:
        months = months[:-1]
    first_day = df["InvoiceDate"].min()
    if first_day.day > 2:
        months = months[1:]
    return months


def _pct(new: float, old: float) -> float:
    return round((new - old) / old * 100, 1) if old else 0.0


@lru_cache(maxsize=1)
def monthly() -> pd.DataFrame:
    """Monthly revenue, orders, customers (new vs returning) and AOV."""
    inv = invoices()
    first_month = inv.groupby("CustomerID")["Month"].min().rename("FirstMonth")
    inv = inv.join(first_month, on="CustomerID")
    inv["IsNew"] = inv["Month"] == inv["FirstMonth"]
    g = inv.groupby("Month")
    out = pd.DataFrame({
        "revenue": g["Revenue"].sum().round(2),
        "orders": g.size(),
        "customers": g["CustomerID"].nunique(),
        "new_customers": inv[inv["IsNew"]].groupby("Month")["CustomerID"].nunique(),
    }).fillna(0)
    out["returning_customers"] = out["customers"] - out["new_customers"]
    out["aov"] = (out["revenue"] / out["orders"]).round(2)
    complete = set(_complete_months())
    out["complete"] = [m in complete for m in out.index]
    return out


def kpis() -> dict:
    """Headline KPIs with change = last complete month vs the month before."""
    inv = invoices()
    m = monthly()
    full = m[m["complete"]]
    last, prev = full.iloc[-1], full.iloc[-2]
    orders_per_customer = inv.groupby("CustomerID").size()
    repeat_rate = round((orders_per_customer > 1).mean() * 100, 1)

    def spark(col):
        return [float(v) for v in full[col].tail(12)]

    return {
        "period": {"from": str(transactions()["InvoiceDate"].min().date()),
                   "to": str(transactions()["InvoiceDate"].max().date()),
                   "compare": f"{full.index[-1]} vs {full.index[-2]}"},
        "currency": CURRENCY,
        "kpis": {
            "total_revenue": {"value": round(float(inv["Revenue"].sum())),
                              "change": _pct(last["revenue"], prev["revenue"]), "trend": spark("revenue")},
            "total_orders": {"value": int(len(inv)),
                             "change": _pct(last["orders"], prev["orders"]), "trend": spark("orders")},
            "active_customers": {"value": int(inv["CustomerID"].nunique()),
                                 "change": _pct(last["customers"], prev["customers"]), "trend": spark("customers")},
            "avg_order_value": {"value": round(float(inv["Revenue"].mean()), 2),
                                "change": _pct(last["aov"], prev["aov"]), "trend": spark("aov")},
            "repeat_rate": {"value": repeat_rate, "change": None, "trend": []},
            "new_customers": {"value": int(last["new_customers"]),
                              "change": _pct(last["new_customers"], prev["new_customers"]),
                              "trend": spark("new_customers")},
        },
    }


def monthly_series() -> dict:
    m = monthly()
    return {
        "labels": [p.strftime("%b %Y") for p in m.index],
        "revenue": [float(v) for v in m["revenue"]],
        "orders": [int(v) for v in m["orders"]],
        "new_customers": [int(v) for v in m["new_customers"]],
        "returning_customers": [int(v) for v in m["returning_customers"]],
        "aov": [float(v) for v in m["aov"]],
        "complete": [bool(v) for v in m["complete"]],
    }


def by_country(top: int = 6) -> dict:
    s = invoices().groupby("Country")["Revenue"].sum().sort_values(ascending=False)
    head = s.head(top)
    other = s.iloc[top:].sum()
    labels = list(head.index) + (["Other"] if other > 0 else [])
    values = [round(float(v)) for v in head.values] + ([round(float(other))] if other > 0 else [])
    return {"labels": labels, "values": values,
            "share_top": round(float(head.iloc[0] / s.sum() * 100), 1), "top": head.index[0]}


def top_products(n: int = 10) -> dict:
    df = transactions()
    g = (df.groupby(["StockCode", "Description"])
           .agg(revenue=("Revenue", "sum"), units=("Quantity", "sum"), customers=("CustomerID", "nunique"))
           .reset_index().sort_values("revenue", ascending=False).head(n))
    return {"products": [
        {"code": r.StockCode, "name": r.Description, "revenue": round(float(r.revenue)),
         "units": int(r.units), "customers": int(r.customers)} for r in g.itertuples()]}


def heatmap() -> dict:
    """Orders by weekday x hour (the shop has no Saturday orders in this data)."""
    inv = invoices()
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    inv = inv.assign(day=inv["InvoiceDate"].dt.dayofweek, hour=inv["InvoiceDate"].dt.hour)
    pivot = inv.groupby(["day", "hour"]).size()
    hours = list(range(int(inv["hour"].min()), int(inv["hour"].max()) + 1))
    data = [{"day": days[d], "hour": h, "value": int(pivot.get((d, h), 0))} for d in range(7) for h in hours]
    return {"data": data, "days": days, "hours": hours}


@lru_cache(maxsize=1)
def rfm() -> pd.DataFrame:
    """Recency (days), Frequency (orders), Monetary (GBP) per customer."""
    inv = invoices()
    ref = reference_date()
    g = inv.groupby("CustomerID").agg(
        last=("InvoiceDate", "max"), first=("InvoiceDate", "min"),
        frequency=("InvoiceNo", "nunique"), monetary=("Revenue", "sum"),
        country=("Country", "first"))
    g["recency"] = (ref - g["last"].dt.normalize()).dt.days
    g["tenure"] = (ref - g["first"].dt.normalize()).dt.days
    return g[["recency", "frequency", "monetary", "tenure", "country"]]


def dataset_summary() -> dict:
    df = transactions()
    return {
        "name": "UCI Online Retail (cleaned)",
        "source": "https://archive.ics.uci.edu/dataset/352/online+retail",
        "license": "CC BY 4.0",
        "rows": int(len(df)),
        "invoices": int(df["InvoiceNo"].nunique()),
        "customers": int(df["CustomerID"].nunique()),
        "products": int(df["StockCode"].nunique()),
        "countries": int(df["Country"].nunique()),
        "from": str(df["InvoiceDate"].min().date()),
        "to": str(df["InvoiceDate"].max().date()),
        "currency": CURRENCY,
    }


def pareto_share(top_pct: float = 20) -> float:
    """Share of revenue from the top X% of customers."""
    m = rfm()["monetary"].sort_values(ascending=False)
    k = max(1, int(len(m) * top_pct / 100))
    return round(float(m.head(k).sum() / m.sum() * 100), 1)


def peak_slot() -> dict:
    inv = invoices()
    by_day = inv.groupby(inv["InvoiceDate"].dt.day_name()).size()
    by_hour = inv.groupby(inv["InvoiceDate"].dt.hour).size()
    return {"day": str(by_day.idxmax()), "hour": int(by_hour.idxmax()),
            "day_share": round(float(by_day.max() / by_day.sum() * 100), 1)}


def computed_once(name: str, version: int = 1):
    """Run an expensive analysis once per process (thread-safe) and keep the result
    on disk, keyed by the data file's timestamp, so restarts are instant.
    Delete saved_models/cache_*.joblib to force a retrain."""
    import functools
    import threading

    import joblib

    def deco(fn):
        lock = threading.Lock()
        memo = {}

        @functools.wraps(fn)
        def wrapper():
            if "v" in memo:
                return memo["v"]
            with lock:
                if "v" in memo:
                    return memo["v"]
                key = (os.path.getmtime(DATA_PATH) if os.path.exists(DATA_PATH) else 0, version)
                path = os.path.join(BASE_DIR, "saved_models", f"cache_{name}.joblib")
                if os.path.exists(path):
                    try:
                        saved = joblib.load(path)
                        if saved.get("key") == key:
                            memo["v"] = saved["value"]
                            return memo["v"]
                    except Exception:
                        pass
                value = fn()
                os.makedirs(os.path.dirname(path), exist_ok=True)
                joblib.dump({"key": key, "value": value}, path)
                memo["v"] = value
                return value

        wrapper.cache_clear = memo.clear
        return wrapper
    return deco
