# api/analytics.py — Dashboard analytics computed from the transaction data

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import Dataset, Prediction, User, get_db
from ml_engine import churn, data_engine, forecast
from utils.auth import get_current_user

router = APIRouter()


def _safe(fn, *a, **kw):
    try:
        return fn(*a, **kw)
    except data_engine.DataNotReady as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/dashboard")
def dashboard_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    out = _safe(data_engine.kpis)
    ch = churn.public()
    out["churn_rate"] = ch["churn_rate"]
    out["model"] = {"name": ch["model_used"], "roc_auc": ch["holdout"]["roc_auc"], "task": "90-day churn"}
    out["datasets_count"] = db.query(Dataset).filter(Dataset.owner_id == current_user.id).count()
    out["predictions_count"] = db.query(Prediction).filter(Prediction.owner_id == current_user.id).count()
    out["dataset"] = data_engine.dataset_summary()
    return out


@router.get("/monthly")
def monthly(current_user: User = Depends(get_current_user)):
    return _safe(data_engine.monthly_series)


@router.get("/countries")
def countries(top: int = 6, current_user: User = Depends(get_current_user)):
    return _safe(data_engine.by_country, top)


@router.get("/products")
def products(n: int = 10, current_user: User = Depends(get_current_user)):
    return _safe(data_engine.top_products, n)


@router.get("/heatmap")
def heatmap(current_user: User = Depends(get_current_user)):
    return _safe(data_engine.heatmap)


@router.get("/forecast")
def revenue_forecast(current_user: User = Depends(get_current_user)):
    return _safe(forecast.run)


@router.get("/dataset")
def dataset_info(current_user: User = Depends(get_current_user)):
    return _safe(data_engine.dataset_summary)
