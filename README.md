# AI-Driven Decision Support System for Retail Analytics

A full-stack decision support system that turns raw e-commerce transactions into
decisions: which customers are about to leave, which ones are worth saving, how
much a retention campaign should cost, and what revenue to expect next.

It runs on a **real public dataset** (UCI Online Retail, 541,909 invoice lines from a
UK online retailer, Dec 2010 – Dec 2011). Every number in the app is computed from
that data or from a model trained on it; nothing is hardcoded.

> Version 2 (Nov 2026). Version 1 was my MBA (Data Science & AI) final-year project,
> which used a 50-row sample table and placeholder dashboard values. Version 2
> rebuilds the analytics and ML layer on real data with proper validation.

## Results (from the app, reproducible with `pytest`)

| Area | Method | Result |
|---|---|---|
| Data cleaning | Drop rows without customer ID, cancellations and orders they reverse, non-product lines | 541,909 → 393,532 lines · 18,279 orders · 4,324 customers · 37 countries · £8.34M revenue |
| Churn prediction (90-day) | Time-based split, 10 behavioural features, Logistic Regression vs Random Forest vs Gradient Boosting, 5-fold stratified CV | Best: Logistic Regression, **ROC-AUC 0.742 ± 0.015**; hold-out ROC-AUC 0.733, recall 77%, precision 58% (base churn rate 43%) |
| Customer segmentation | RFM features (log-scaled) + K-Means, k chosen by silhouette | k = 4 (silhouette 0.38). "Champions" are 12.7% of customers but **61.7% of revenue** |
| Revenue forecasting | Naive vs 4-week moving average vs Ridge on lags, 12-week rolling backtest | Moving average wins: **MAPE 14.2%**, 26% lower error than the naive baseline |
| Retention decision | Expected loss = churn probability × quarterly spend; sweep how many customers to contact | At £5/contact and a 20% save rate: contact 2,843 customers, protect ≈ £46K for £14K, **net ≈ £32K** |
| Business facts | Pareto, market concentration | Top 20% of customers = 73.6% of revenue; UK = 82.3% of revenue |

## What the app does

- **Dashboard**: revenue, orders, active customers, AOV, repeat rate and churn rate, with
  month-over-month change on complete months only; monthly trend; new vs returning
  customers; revenue by country; top products; weekly revenue forecast with an 80% band.
- **Customers & Churn**: RFM segments with a recommended action for each; churn model
  comparison, hold-out confusion matrix and permutation feature importance; a
  **retention what-if** where you set cost per contact and save rate and the system finds
  the number of customers that maximises net gain; and a ranked call list.
- **Forecasting**: the backtest behind the forecast, predicted vs actual, and each model's MAE/MAPE.
- **AI Insights + assistant**: insights generated from computed facts, each showing its source;
  the assistant answers from the same numbers.
- **ML workbench**: upload any CSV/Excel, pick a target and train 6 algorithms. One scikit-learn
  pipeline (imputation, one-hot encoding, scaling, model), k-fold cross-validation, an automatic
  **leakage guard** (drops IDs, dates and columns the target is derived from), and predictions
  from raw input.
- **Reports**: PDF and Excel reports with the real KPIs, model comparison, segments and insights.
- JWT auth with user/admin roles, activity log, admin panel.

## Architecture

```
React (Vite, Recharts) ──REST + JWT──► FastAPI
                                        ├─ api/analytics   → ml_engine/data_engine  (KPIs, trends)
                                        ├─ api/decisions   → ml_engine/segmentation (RFM + K-Means)
                                        │                    ml_engine/churn        (models, what-if)
                                        ├─ api/analytics/forecast → ml_engine/forecast (backtest)
                                        ├─ api/insights    → ml_engine/insights     (facts → text)
                                        ├─ api/ml          → ml_engine/trainer      (generic workbench)
                                        └─ api/reports     → ReportLab / OpenPyXL
SQLite (users, datasets, model runs, logs) · trained models + results cached in backend/saved_models/
```

Heavy work (churn CV, clustering, backtest) runs once in a background thread at startup and is
cached to disk, keyed by the data file's timestamp, so later starts load in under a second.

## Run it locally

**1. Backend** (Python 3.12/3.13)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
```

**2. Get the data** (once): download *Online Retail* from
https://archive.ics.uci.edu/dataset/352/online+retail (CC BY 4.0), unzip, then:
```bash
python scripts/prepare_online_retail.py "path/to/Online Retail.xlsx"
```
This writes `datasets/online_retail_clean.csv.gz` and prints the cleaning summary.

**3. Start the API**
```bash
uvicorn main:app --reload
```
The first start trains the models (about 1–2 minutes); after that it is instant.

**4. Frontend**
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 and use the demo login buttons (user@demo.com / user123,
admin@demo.com / admin123). Change or remove these accounts before any real deployment.

**Tests**
```bash
cd backend
pytest -q
```
23 tests check that revenue adds up, month-over-month uses complete months, the forecast
beats the naive baseline, segments cover every customer, the churn model uses only past data
and beats chance, the retention recommendation is the optimum, the leakage guard works, and
every API endpoint responds.

**Docker**: set `SECRET_KEY` first (the API refuses to start in production without it), then
`docker-compose up --build`.

## Honest limitations

- One year of history: yearly seasonality (the November peak) cannot be learned, so forecast
  intervals are wide around the holidays.
- Churn ROC-AUC of ~0.74 is realistic for behaviour-only features; adding marketing, support
  or browsing data would help. Save rate and contact cost in the what-if are assumptions.
- Retention targets only customers active in the last 180 days; older ones need a separate,
  cheaper win-back campaign.
- SQLite and in-process training suit a single-team prototype; production would use
  PostgreSQL and a scheduled training job.

## Data credit

Chen, D. (2015). Online Retail [Dataset]. UCI Machine Learning Repository.
https://doi.org/10.24432/C5BW33 — licensed CC BY 4.0.
