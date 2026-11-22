# api/decisions.py — Customer intelligence: segments, churn risk, retention what-if

from fastapi import APIRouter, Depends, HTTPException, Query

from database import User
from ml_engine import churn, data_engine, segmentation
from utils.auth import get_current_user

router = APIRouter()


def _guard(fn, *a, **kw):
    try:
        return fn(*a, **kw)
    except data_engine.DataNotReady as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/segments")
def segments(current_user: User = Depends(get_current_user)):
    return _guard(segmentation.public)


@router.get("/churn")
def churn_model(current_user: User = Depends(get_current_user)):
    return _guard(churn.public)


@router.get("/at-risk")
def at_risk(limit: int = Query(25, ge=1, le=200), current_user: User = Depends(get_current_user)):
    return {"customers": _guard(churn.at_risk, limit), "currency": data_engine.CURRENCY}


@router.get("/retention-plan")
def retention_plan(
    contact_cost: float = Query(5.0, ge=0, le=1000),
    save_rate: float = Query(0.20, gt=0, le=1),
    top_n: int | None = Query(None, ge=1),
    current_user: User = Depends(get_current_user),
):
    return _guard(churn.retention_plan, contact_cost, save_rate, top_n)
