# api/ml.py — Generic ML workbench: train, compare, predict on any table

import json
import os
from typing import Optional

import joblib
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import AnalyticsLog, Dataset, Prediction, User, get_db
from ml_engine.trainer import ALGORITHMS, predict_one, train_model
from utils.auth import get_current_user

router = APIRouter()
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "saved_models")
SAMPLE = os.path.join(BASE_DIR, "datasets", "sample_business_data.csv")


class TrainRequest(BaseModel):
    dataset_id: Optional[int] = None          # None = built-in sample table
    algorithm: str = "random_forest"
    target_column: str = "revenue_category"
    task_type: str = "classification"          # classification | regression
    test_size: float = Field(0.2, gt=0.05, lt=0.5)
    preprocessing: bool = True                 # kept for the old UI; the pipeline always preprocesses


class CompareRequest(BaseModel):
    dataset_id: Optional[int] = None
    target_column: str = "revenue_category"
    task_type: str = "classification"


class PredictRequest(BaseModel):
    prediction_id: int
    input_data: dict


def _load_df(dataset_id: Optional[int], db: Session, user: User) -> pd.DataFrame:
    if dataset_id:
        ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == user.id).first()
        if not ds:
            raise HTTPException(status_code=404, detail="Dataset not found")
        path = ds.file_path
    else:
        path = SAMPLE
    ext = os.path.splitext(path)[1].lower()
    return pd.read_csv(path) if ext in (".csv", ".gz") else pd.read_excel(path)


def _supports(algorithm: str, task_type: str) -> bool:
    kind = ALGORITHMS.get(algorithm)
    return kind in ("both", task_type)


def _train_and_store(req: TrainRequest, df: pd.DataFrame, db: Session, user: User) -> dict:
    if req.target_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column '{req.target_column}' not found. "
                                                    f"Available: {', '.join(map(str, df.columns))}")
    if not _supports(req.algorithm, req.task_type):
        raise HTTPException(status_code=400, detail=f"{req.algorithm} does not support {req.task_type}")
    try:
        result = train_model(df, req.target_column, req.algorithm, req.task_type, req.test_size)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    pipe = result.pop("model_obj")
    os.makedirs(MODEL_DIR, exist_ok=True)
    model_path = os.path.join(MODEL_DIR, f"model_{user.id}_{req.algorithm}_{result['job_id']}.joblib")
    joblib.dump({"pipeline": pipe, "features": result["features_used"], "meta": result}, model_path)

    rec = Prediction(
        dataset_id=req.dataset_id, algorithm=req.algorithm, task_type=req.task_type,
        target_column=req.target_column, accuracy=result.get("accuracy", 0.0),
        precision=result.get("precision", 0.0), recall=result.get("recall", 0.0),
        f1_score=result.get("f1_score", 0.0), mse=result.get("mse", 0.0), r2_score=result.get("r2_score", 0.0),
        confusion_matrix=json.dumps(result.get("confusion_matrix", [])),
        feature_importance=json.dumps(result.get("feature_importance", {})),
        model_path=model_path, owner_id=user.id,
    )
    db.add(rec)
    db.add(AnalyticsLog(action="Model trained", user_id=user.id, details=f"Algorithm: {req.algorithm}"))
    db.commit()
    db.refresh(rec)
    result["prediction_id"] = rec.id
    return result


@router.post("/train")
def train(req: TrainRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Train one model with cross-validation and a leakage check."""
    return _train_and_store(req, _load_df(req.dataset_id, db, current_user), db, current_user)


@router.post("/compare-run")
def compare_run(req: CompareRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Train every algorithm that fits the task on the same data and rank them."""
    df = _load_df(req.dataset_id, db, current_user)
    rows = []
    for algo in ALGORITHMS:
        if not _supports(algo, req.task_type):
            continue
        r = _train_and_store(TrainRequest(dataset_id=req.dataset_id, algorithm=algo, target_column=req.target_column,
                                          task_type=req.task_type), df, db, current_user)
        rows.append({k: r.get(k) for k in ("algorithm", "accuracy", "accuracy_std", "precision", "recall", "f1_score",
                                            "r2_score", "r2_std", "mae", "prediction_id", "baseline_accuracy")})
    key = "f1_score" if req.task_type == "classification" else "r2_score"
    rows.sort(key=lambda r: r.get(key) or 0, reverse=True)
    return {"task_type": req.task_type, "ranked_by": key, "results": rows,
            "dropped_columns": r.get("dropped_columns", []) if rows else []}


@router.get("/results/{prediction_id}")
def get_result(prediction_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(Prediction).filter(Prediction.id == prediction_id, Prediction.owner_id == current_user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Prediction not found")
    meta = {}
    if p.model_path and os.path.exists(p.model_path) and p.model_path.endswith(".joblib"):
        meta = joblib.load(p.model_path).get("meta", {})
    return {**meta, "id": p.id, "created_at": p.created_at}


@router.get("/history")
def prediction_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    records = (db.query(Prediction).filter(Prediction.owner_id == current_user.id)
               .order_by(Prediction.created_at.desc()).all())
    return [{"id": r.id, "algorithm": r.algorithm, "task_type": r.task_type, "target_column": r.target_column,
             "accuracy": r.accuracy, "f1_score": r.f1_score, "r2_score": r.r2_score, "created_at": r.created_at}
            for r in records]


@router.get("/compare")
def compare_algorithms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Latest run of each algorithm the user has trained. No demo numbers."""
    records = (db.query(Prediction).filter(Prediction.owner_id == current_user.id)
               .order_by(Prediction.created_at.desc()).all())
    seen = {}
    for r in records:
        seen.setdefault((r.algorithm, r.task_type, r.target_column), r)
    return {"comparison": [
        {"algorithm": _pretty_name(r.algorithm), "task_type": r.task_type, "target": r.target_column,
         "accuracy": r.accuracy, "precision": r.precision, "recall": r.recall, "f1_score": r.f1_score,
         "r2_score": r.r2_score} for r in seen.values()],
        "message": None if seen else "No models trained yet. Train one on the ML Models page."}


@router.post("/predict")
def predict_single(req: PredictRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(Prediction).filter(Prediction.id == req.prediction_id, Prediction.owner_id == current_user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Model not found")
    if not os.path.exists(p.model_path) or not p.model_path.endswith(".joblib"):
        raise HTTPException(status_code=409, detail="This model was trained with the old version. Please retrain it.")
    bundle = joblib.load(p.model_path)
    try:
        out = predict_one(bundle["pipeline"], bundle["features"], req.input_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Prediction error: {e}")
    return {**out, "algorithm": p.algorithm, "features": bundle["features"]}


def _pretty_name(algo: str) -> str:
    return {"linear_regression": "Linear Regression", "logistic_regression": "Logistic Regression",
            "decision_tree": "Decision Tree", "random_forest": "Random Forest",
            "gradient_boosting": "Gradient Boosting", "svm": "Support Vector Machine"}.get(algo, algo)
