"""Clean the UCI "Online Retail" dataset into the CSV the app analyses.

Source: Daqing Chen, UCI Machine Learning Repository, dataset 352
https://archive.ics.uci.edu/dataset/352/online+retail  (CC BY 4.0)
541,909 invoice lines from a UK online gift retailer, Dec 2010 - Dec 2011.

Usage (from backend/):
    python scripts/prepare_online_retail.py "path/to/Online Retail.xlsx"

Cleaning rules (documented so they can be explained in an interview):
  1. Drop lines without a CustomerID: customer analytics (RFM, churn) need it.
  2. Separate cancellations (InvoiceNo starts with "C"); they are kept only as a
     per-customer return count, not as sales.
  3. Drop non-product lines (postage, bank charges, manual adjustments, samples).
  4. Drop lines with Quantity <= 0 or UnitPrice <= 0.
  5. Revenue = Quantity * UnitPrice.
"""
from __future__ import annotations

import os
import sys

import pandas as pd

NON_PRODUCT_CODES = {"POST", "DOT", "M", "BANK CHARGES", "C2", "CRUK", "D", "PADS", "S", "AMAZONFEE", "B"}
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "datasets")


def clean(raw: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    df = raw.copy()
    df["InvoiceNo"] = df["InvoiceNo"].astype(str)
    df["StockCode"] = df["StockCode"].astype(str).str.upper().str.strip()
    stats = {"raw_rows": len(df)}

    df = df.dropna(subset=["CustomerID"])
    stats["after_drop_missing_customer"] = len(df)
    df["CustomerID"] = df["CustomerID"].astype(int)

    is_cancel = df["InvoiceNo"].str.startswith("C")
    cancels = df[is_cancel]
    returns = cancels.groupby("CustomerID").size().rename("ReturnLines").reset_index()
    df = df[~is_cancel]
    stats["cancellation_lines_removed"] = int(is_cancel.sum())

    # A cancellation that exactly reverses an earlier order line (same customer,
    # product and quantity) means that sale never really happened: drop it too.
    # Without this, e.g. one 80,995-unit order that was cancelled the same day
    # becomes the "top product" and one customer looks worth £168k.
    buys = df.reset_index().rename(columns={"index": "row"})
    c = cancels.assign(Quantity=-cancels["Quantity"])[["CustomerID", "StockCode", "Quantity", "InvoiceDate"]]
    m = buys.merge(c, on=["CustomerID", "StockCode", "Quantity"], suffixes=("", "_cancel"))
    m = m[m["InvoiceDate"] <= m["InvoiceDate_cancel"]]
    m = m.sort_values("InvoiceDate").groupby(["CustomerID", "StockCode", "Quantity", "InvoiceDate_cancel"]).tail(1)
    df = df.drop(index=m["row"].unique())
    stats["reversed_order_lines_removed"] = int(m["row"].nunique())

    df = df[~df["StockCode"].isin(NON_PRODUCT_CODES)]
    df = df[(df["Quantity"] > 0) & (df["UnitPrice"] > 0)]
    df["Description"] = df["Description"].astype(str).str.strip().str.title()
    df["Revenue"] = (df["Quantity"] * df["UnitPrice"]).round(2)
    df["InvoiceDate"] = pd.to_datetime(df["InvoiceDate"])
    stats["clean_rows"] = len(df)
    stats["customers"] = int(df["CustomerID"].nunique())
    stats["invoices"] = int(df["InvoiceNo"].nunique())
    stats["date_min"] = str(df["InvoiceDate"].min().date())
    stats["date_max"] = str(df["InvoiceDate"].max().date())

    cols = ["InvoiceNo", "StockCode", "Description", "Quantity", "InvoiceDate",
            "UnitPrice", "Revenue", "CustomerID", "Country"]
    return df[cols].sort_values("InvoiceDate"), returns, stats


def main(path: str) -> None:
    raw = pd.read_excel(path, dtype={"InvoiceNo": str, "StockCode": str})
    df, returns, stats = clean(raw)
    os.makedirs(OUT_DIR, exist_ok=True)
    df.to_csv(os.path.join(OUT_DIR, "online_retail_clean.csv.gz"), index=False, compression="gzip")
    returns.to_csv(os.path.join(OUT_DIR, "online_retail_returns.csv"), index=False)
    for k, v in stats.items():
        print(f"{k:32s} {v}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
