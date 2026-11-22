# api/admin.py — Admin panel endpoints

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db, User, Dataset, Prediction, Report, AnalyticsLog
from utils.auth import get_current_user, get_admin_user
from datetime import datetime

router = APIRouter()


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/stats")
def admin_stats(db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    """Overall system statistics for admin."""
    return {
        "total_users":       db.query(User).count(),
        "active_users":      db.query(User).filter(User.is_active == True).count(),
        "total_datasets":    db.query(Dataset).count(),
        "total_predictions": db.query(Prediction).count(),
        "total_reports":     db.query(Report).count(),
        "total_logs":        db.query(AnalyticsLog).count(),
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    """Get all users (admin only)."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at,
            "datasets_count":    db.query(Dataset).filter(Dataset.owner_id == u.id).count(),
            "predictions_count": db.query(Prediction).filter(Prediction.owner_id == u.id).count(),
        }
        for u in users
    ]


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    req: UpdateUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own admin account")

    if req.name is not None:       user.name      = req.name
    if req.role is not None:       user.role      = req.role
    if req.is_active is not None:  user.is_active = req.is_active
    db.commit()
    db.add(AnalyticsLog(action="Admin updated user", user_id=admin.id, details=f"User ID: {user_id}"))
    db.commit()
    return {"message": "User updated successfully"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}


@router.get("/datasets")
def all_datasets(db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    """All datasets across all users."""
    import json
    datasets = db.query(Dataset).order_by(Dataset.uploaded_at.desc()).all()
    result = []
    for d in datasets:
        owner = db.query(User).filter(User.id == d.owner_id).first()
        result.append({
            "id": d.id,
            "name": d.name,
            "rows": d.rows,
            "columns": d.columns,
            "size_kb": d.size_kb,
            "uploaded_at": d.uploaded_at,
            "owner": owner.name if owner else "Unknown",
            "owner_email": owner.email if owner else "",
        })
    return result


@router.get("/logs")
def system_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """System activity logs."""
    logs = db.query(AnalyticsLog).order_by(AnalyticsLog.timestamp.desc()).limit(limit).all()
    result = []
    for log in logs:
        user = db.query(User).filter(User.id == log.user_id).first() if log.user_id else None
        result.append({
            "id": log.id,
            "action": log.action,
            "user": user.name if user else "System",
            "user_email": user.email if user else "",
            "details": log.details,
            "timestamp": log.timestamp,
        })
    return result


@router.get("/model-performance")
def model_performance(db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    """Aggregate model performance metrics."""
    preds = db.query(Prediction).all()
    if not preds:
        return {"average_accuracy": 0, "total_models": 0, "by_algorithm": {}}

    by_algo = {}
    for p in preds:
        if p.algorithm not in by_algo:
            by_algo[p.algorithm] = {"count": 0, "accuracy_sum": 0}
        by_algo[p.algorithm]["count"] += 1
        by_algo[p.algorithm]["accuracy_sum"] += p.accuracy

    result = {}
    for algo, data in by_algo.items():
        result[algo] = {
            "count": data["count"],
            "avg_accuracy": round(data["accuracy_sum"] / data["count"], 2),
        }

    total_acc = sum(p.accuracy for p in preds) / len(preds)
    return {
        "average_accuracy": round(total_acc, 2),
        "total_models": len(preds),
        "by_algorithm": result,
    }
