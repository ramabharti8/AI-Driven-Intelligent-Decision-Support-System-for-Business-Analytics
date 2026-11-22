# main.py — FastAPI application entry point

import os
import threading
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from api import admin, analytics, auth, datasets, decisions, insights, ml, reports  # noqa: E402
from database import init_db  # noqa: E402

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _warm_models():
    """Compute analytics and train the churn/segment models once, in the background,
    so the first dashboard request is fast."""
    try:
        from ml_engine import churn, forecast, segmentation
        forecast.run()
        segmentation.run()
        churn.run()
        print("[OK] Analytics and models ready")
    except Exception as e:  # data missing etc. — endpoints report it clearly
        print(f"[WARN] Model warm-up skipped: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    for d in ("datasets", "saved_models", "reports"):
        os.makedirs(os.path.join(BASE_DIR, d), exist_ok=True)
    init_db()
    if os.getenv("WARM_MODELS", "1") == "1":
        threading.Thread(target=_warm_models, daemon=True).start()
    yield


app = FastAPI(
    title="AI Decision Support System API",
    description="Business analytics, churn prediction, segmentation and forecasting on real retail data",
    version="2.0.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/api/auth",      tags=["Authentication"])
app.include_router(datasets.router,  prefix="/api/datasets",  tags=["Datasets"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(decisions.router, prefix="/api/decisions", tags=["Customer decisions"])
app.include_router(ml.router,        prefix="/api/ml",        tags=["ML workbench"])
app.include_router(reports.router,   prefix="/api/reports",   tags=["Reports"])
app.include_router(admin.router,     prefix="/api/admin",     tags=["Admin"])
app.include_router(insights.router,  prefix="/api/insights",  tags=["AI Insights"])


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "AI Decision Support System API"}


@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "healthy", "version": "2.0.0"}
