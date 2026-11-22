# api/insights.py — AI Insights & Chatbot

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from database import get_db, User
from utils.auth import get_current_user
from ml_engine.insights import generate_insights, get_chatbot_response
from sqlalchemy.orm import Session

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    context: dict = {}


@router.get("/")
def get_insights(current_user: User = Depends(get_current_user)):
    """Get AI-generated business insights."""
    insights = generate_insights()
    return {"insights": insights, "total": len(insights)}


@router.post("/chat")
def chat(req: ChatRequest, current_user: User = Depends(get_current_user)):
    """AI chatbot endpoint."""
    response = get_chatbot_response(req.message, req.context)
    return {
        "message": req.message,
        "response": response,
        "user": current_user.name,
    }
