"""Business insights and the assistant, generated from computed facts.

The first version filled text templates with random numbers. Here every
sentence is built from a number computed from the data or from a trained
model, and each insight says where its number comes from.
"""
from __future__ import annotations

from datetime import datetime

from ml_engine import churn, data_engine, forecast, segmentation


def _money(v: float) -> str:
    return f"£{v:,.0f}"


def _facts() -> dict:
    k = data_engine.kpis()
    m = data_engine.monthly()
    full = m[m["complete"]]
    seg = segmentation.public()
    ch = churn.public()
    fc = forecast.run()
    plan = churn.retention_plan()
    best_month = full["revenue"].idxmax()
    return {
        "kpis": k, "monthly": full, "seg": seg, "churn": ch, "forecast": fc, "plan": plan,
        "best_month": best_month.strftime("%B %Y"), "best_month_rev": float(full["revenue"].max()),
        "country": data_engine.by_country(), "products": data_engine.top_products(5)["products"],
        "pareto": data_engine.pareto_share(20), "peak": data_engine.peak_slot(),
    }


def generate_insights(context: dict | None = None) -> list[dict]:
    f = _facts()
    k = f["kpis"]["kpis"]
    out = []

    def add(title, desc, severity, category, source):
        out.append({"id": len(out) + 1, "title": title, "description": desc, "severity": severity,
                    "category": category, "source": source, "timestamp": datetime.utcnow().isoformat()})

    rev = k["total_revenue"]
    add("Revenue trend", f"Revenue changed {rev['change']:+.1f}% in {f['kpis']['period']['compare']}. "
        f"The best month was {f['best_month']} at {_money(f['best_month_rev'])}.",
        "positive" if rev["change"] >= 0 else "warning", "revenue", "Monthly revenue from invoices")
    add("Revenue concentration", f"The top 20% of customers bring in {f['pareto']}% of revenue. "
        "Losing a few of them hurts far more than losing many small buyers.",
        "warning" if f["pareto"] > 70 else "positive", "customers", "Customer spend ranking")
    c = f["country"]
    add("Market dependence", f"{c['top']} accounts for {c['share_top']}% of revenue. "
        "International markets are a growth option and a diversification hedge.",
        "warning" if c["share_top"] > 75 else "positive", "revenue", "Revenue by country")
    ch = f["churn"]
    add("Churn risk", f"{ch['churn_rate']}% of customers active before {ch['cutoff']} did not order in the next 90 days. "
        f"The {ch['model_used'].replace('_', ' ')} model ranks who is likely to leave with ROC-AUC "
        f"{ch['holdout']['roc_auc']} on unseen customers.", "danger" if ch["churn_rate"] > 30 else "warning",
        "customers", "Churn model, 5-fold cross-validation + hold-out")
    p = f["plan"]
    add("Retention decision", f"Contacting the top {p['recommended_n']} at-risk customers (at £{p['inputs']['contact_cost']:.0f} each, "
        f"{p['inputs']['save_rate']:.0%} save rate) is expected to protect {_money(p['expected_revenue_saved'])} "
        f"for {_money(p['campaign_cost'])}: net {_money(p['net_gain'])}.", "positive", "decision",
        "Churn probabilities x customer value (assumptions editable)")
    top_seg = f["seg"]["segments"][0]
    add("Most valuable segment", f"'{top_seg['segment']}' customers are {top_seg['customer_share']}% of the base "
        f"but {top_seg['revenue_share']}% of revenue. {top_seg['action']}", "positive", "customers",
        f"K-Means on RFM, k={f['seg']['k']} by silhouette")
    risk_seg = next((s for s in f["seg"]["segments"] if s["segment"].startswith("At Risk")), None)
    if risk_seg:
        add("High-value customers slipping", f"{risk_seg['customers']} customers ({_money(risk_seg['revenue'])} lifetime spend) "
            f"have not ordered for about {risk_seg['avg_recency_days']} days on average. {risk_seg['action']}",
            "danger", "customers", "RFM segmentation")
    fc = f["forecast"]
    nxt = sum(fc["forecast"]["predicted"][:4])
    add("Next 4 weeks", f"Forecast revenue for the next 4 weeks is about {_money(nxt)} "
        f"({fc['model_used'].replace('_', ' ')}, backtest MAPE {next(m['mape'] for m in fc['models'] if m['model'] == fc['model_used'])}%).",
        "positive", "forecast", f"Rolling backtest over {fc['backtest_weeks']} weeks")
    prod = f["products"][0]
    add("Top product", f"'{prod['name']}' is the top seller by revenue ({_money(prod['revenue'])} from {prod['customers']} customers). "
        "Keep it in stock before peak season.", "positive", "operations", "Product revenue ranking")
    pk = f["peak"]
    add("Peak ordering time", f"{pk['day']} is the busiest day ({pk['day_share']}% of orders) and {pk['hour']}:00 the busiest hour. "
        "Schedule campaigns and support staff around it.", "positive", "operations", "Order timestamps")
    return out


def get_chatbot_response(message: str, context: dict | None = None) -> str:
    """Intent-matching assistant that answers with computed numbers only."""
    msg = message.lower()
    f = _facts()
    k = f["kpis"]["kpis"]

    if any(w in msg for w in ["hello", "hi", "hey", "help", "start"]) and len(msg) < 25:
        return ("Hi! I answer from the real data. Ask about **revenue**, **customers**, **churn**, "
                "**segments**, **forecast**, **products**, **countries** or **what to do**.")
    if any(w in msg for w in ["revenue", "sales", "income"]):
        r = k["total_revenue"]
        return (f"**Revenue**: {_money(r['value'])} from {k['total_orders']['value']:,} orders "
                f"({f['kpis']['period']['from']} to {f['kpis']['period']['to']}). "
                f"Last complete month changed {r['change']:+.1f}% ({f['kpis']['period']['compare']}). "
                f"Average order value {_money(k['avg_order_value']['value'])}.")
    if any(w in msg for w in ["churn", "leave", "retention", "risk"]):
        ch, p = f["churn"], f["plan"]
        return (f"**Churn**: {ch['churn_rate']}% of customers did not return within 90 days. "
                f"Best model: {ch['model_used'].replace('_', ' ')} (hold-out ROC-AUC {ch['holdout']['roc_auc']}). "
                f"Top driver: {ch['feature_importance'][0]['label'].lower()}. "
                f"Recommended action: contact the top {p['recommended_n']} at-risk customers for an expected net gain of {_money(p['net_gain'])}.")
    if any(w in msg for w in ["segment", "rfm", "cluster", "customer"]):
        lines = [f"• {s['segment']}: {s['customers']} customers, {s['revenue_share']}% of revenue"
                 for s in f["seg"]["segments"]]
        return "**Customer segments** (K-Means on RFM):\n" + "\n".join(lines)
    if any(w in msg for w in ["forecast", "predict", "next", "future"]):
        fc = f["forecast"]
        return (f"**Forecast**: next 8 weeks ≈ {_money(sum(fc['forecast']['predicted']))} "
                f"using {fc['model_used'].replace('_', ' ')}, chosen by backtest. "
                f"Intervals are {fc['forecast']['interval']}. {fc['note']}")
    if any(w in msg for w in ["product", "item", "stock"]):
        return "**Top products by revenue**:\n" + "\n".join(
            f"• {p['name']}: {_money(p['revenue'])}" for p in f["products"])
    if any(w in msg for w in ["country", "market", "region"]):
        c = f["country"]
        return "**Revenue by country**:\n" + "\n".join(f"• {l}: {_money(v)}" for l, v in zip(c["labels"], c["values"]))
    if any(w in msg for w in ["recommend", "suggest", "action", "what should", "strategy", "improve"]):
        return "**Recommended actions**:\n" + "\n".join(
            f"{i}. {ins['title']}: {ins['description']}" for i, ins in enumerate(generate_insights()[:5], 1))
    if any(w in msg for w in ["model", "accuracy", "ml"]):
        ch = f["churn"]
        rows = "\n".join(f"• {c['algorithm'].replace('_', ' ')}: ROC-AUC {c['roc_auc']} ± {c['roc_auc_std']}"
                         for c in ch["comparison"])
        return f"**Churn model comparison** (5-fold CV):\n{rows}"
    return ("I couldn't match that to a question I can answer from the data. "
            "Try: revenue, churn, segments, forecast, products, countries, or recommendations.")
