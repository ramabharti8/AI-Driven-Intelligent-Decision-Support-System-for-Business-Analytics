# api/datasets.py — Dataset upload, preview, delete

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from database import get_db, User, Dataset, AnalyticsLog
from utils.auth import get_current_user
import pandas as pd
import json, os, shutil
from datetime import datetime

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "datasets")
MAX_FILE_SIZE_MB = 50


@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = Form(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a CSV or Excel dataset."""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".csv", ".xlsx", ".xls"]:
        raise HTTPException(status_code=400, detail="Only CSV or Excel files are allowed")

    # Save file
    safe_name = f"{current_user.id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Parse with pandas
    try:
        df = pd.read_csv(file_path) if ext == ".csv" else pd.read_excel(file_path)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Could not parse file: {str(e)}")

    size_kb = os.path.getsize(file_path) / 1024

    ds = Dataset(
        name=name or file.filename,
        filename=file.filename,
        file_path=file_path,
        rows=len(df),
        columns=len(df.columns),
        column_names=json.dumps(list(df.columns)),
        size_kb=round(size_kb, 2),
        owner_id=current_user.id,
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)

    db.add(AnalyticsLog(action="Dataset uploaded", user_id=current_user.id, details=f"Dataset: {file.filename}"))
    db.commit()

    return {
        "id": ds.id,
        "name": ds.name,
        "rows": ds.rows,
        "columns": ds.columns,
        "column_names": json.loads(ds.column_names),
        "size_kb": ds.size_kb,
        "uploaded_at": ds.uploaded_at,
        "message": "Dataset uploaded successfully",
    }


@router.get("/")
def list_datasets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List all datasets for the current user."""
    datasets = db.query(Dataset).filter(Dataset.owner_id == current_user.id).order_by(Dataset.uploaded_at.desc()).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "filename": d.filename,
            "rows": d.rows,
            "columns": d.columns,
            "column_names": json.loads(d.column_names) if d.column_names else [],
            "size_kb": d.size_kb,
            "uploaded_at": d.uploaded_at,
        }
        for d in datasets
    ]


@router.get("/{dataset_id}/preview")
def preview_dataset(
    dataset_id: int,
    rows: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Preview first N rows of a dataset."""
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == current_user.id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    ext = os.path.splitext(ds.file_path)[1].lower()
    try:
        df = pd.read_csv(ds.file_path) if ext == ".csv" else pd.read_excel(ds.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

    # Column stats
    stats = {}
    for col in df.columns:
        col_data = df[col]
        stats[col] = {
            "dtype": str(col_data.dtype),
            "missing": int(col_data.isna().sum()),
            "unique": int(col_data.nunique()),
        }
        if pd.api.types.is_numeric_dtype(col_data):
            stats[col]["mean"] = round(float(col_data.mean()), 2) if not col_data.isna().all() else None
            stats[col]["std"]  = round(float(col_data.std()), 2)  if not col_data.isna().all() else None
            stats[col]["min"]  = round(float(col_data.min()), 2)  if not col_data.isna().all() else None
            stats[col]["max"]  = round(float(col_data.max()), 2)  if not col_data.isna().all() else None

    preview_df = df.head(rows).fillna("")
    return {
        "columns": list(df.columns),
        "rows": preview_df.to_dict(orient="records"),
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "column_stats": stats,
    }


@router.delete("/{dataset_id}")
def delete_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a dataset."""
    ds = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.owner_id == current_user.id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Delete file from disk
    if os.path.exists(ds.file_path):
        os.remove(ds.file_path)

    db.delete(ds)
    db.commit()
    db.add(AnalyticsLog(action="Dataset deleted", user_id=current_user.id, details=f"Dataset ID: {dataset_id}"))
    db.commit()
    return {"message": "Dataset deleted successfully"}


@router.get("/sample/download")
def download_sample_info():
    """Return info about the built-in sample dataset."""
    sample_path = os.path.join(UPLOAD_DIR, "sample_business_data.csv")
    if not os.path.exists(sample_path):
        raise HTTPException(status_code=404, detail="Sample dataset not found")
    df = pd.read_csv(sample_path)
    return {
        "filename": "sample_business_data.csv",
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
    }
