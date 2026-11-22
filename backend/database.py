# database.py — SQLAlchemy SQLite setup

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///" + os.path.join(BASE_DIR, "ai_decision_support.db").replace("\\", "/"))

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ─── ORM Models ────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(String(20), default="user")          # "admin" | "user"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    datasets = relationship("Dataset", back_populates="owner")
    predictions = relationship("Prediction", back_populates="owner")


class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    filename = Column(String(200), nullable=False)
    file_path = Column(String(500), nullable=False)
    rows = Column(Integer, default=0)
    columns = Column(Integer, default=0)
    column_names = Column(Text, default="")       # JSON list
    size_kb = Column(Float, default=0.0)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="datasets")


class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=True)
    algorithm = Column(String(100), nullable=False)
    task_type = Column(String(50), default="classification")   # classification|regression
    target_column = Column(String(100), default="")
    accuracy = Column(Float, default=0.0)
    precision = Column(Float, default=0.0)
    recall = Column(Float, default=0.0)
    f1_score = Column(Float, default=0.0)
    mse = Column(Float, default=0.0)
    r2_score = Column(Float, default=0.0)
    confusion_matrix = Column(Text, default="")    # JSON
    feature_importance = Column(Text, default="") # JSON
    model_path = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="predictions")


class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    report_type = Column(String(50), default="pdf")  # pdf|excel
    file_path = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))


class AnalyticsLog(Base):
    __tablename__ = "analytics_logs"
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(200), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    details = Column(Text, default="")
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String(50), default="")


# ─── DB Init ────────────────────────────────────────────────────────────────────

def init_db():
    """Create tables and seed default users."""
    Base.metadata.create_all(bind=engine)
    _seed_default_users()


def _seed_default_users():
    from utils.auth import hash_password
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == "admin@demo.com").first():
            return  # Already seeded
        admin = User(
            name="Admin User",
            email="admin@demo.com",
            hashed_password=hash_password("admin123"),
            role="admin",
        )
        user = User(
            name="Demo User",
            email="user@demo.com",
            hashed_password=hash_password("user123"),
            role="user",
        )
        db.add_all([admin, user])
        db.commit()
        print("[OK] Default users seeded: admin@demo.com / admin123 | user@demo.com / user123")
    finally:
        db.close()


def get_db():
    """FastAPI dependency — yields DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
