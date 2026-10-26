"""
SolarAI Assistant API Endpoints (Step 11)
Exposes endpoints to retrieve real IoT grounding context,
conduct grounded conversational queries, and query AI assistant status.
"""

from datetime import datetime, timezone
import os
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services import ai_context_service
from app.services.ai_provider import get_ai_provider
from app.schemas.ai_assistant import (
    SolarAIContextResponse,
    AIChatRequest,
    AIChatResponse,
)

router = APIRouter(prefix="/ai", tags=["ai-assistant"])


@router.get("/context/{device_id}", response_model=SolarAIContextResponse)
def get_device_ai_context(
    device_id: str,
    db: Session = Depends(get_db),
):
    """
    Get consolidated real-hardware IoT telemetry, XGBoost predictions,
    system health scores, active alerts, and 24-hour analytics context for a device.
    """
    return ai_context_service.build_solar_ai_context(db=db, device_id=device_id)


@router.post("/chat", response_model=AIChatResponse)
def chat_with_solar_assistant(
    request: AIChatRequest,
    db: Session = Depends(get_db),
):
    """
    Interact with the grounded AI Solar Performance Assistant.
    Answers are strictly grounded in real database telemetry, active ML predictions,
    system health metrics, and recorded alerts.
    """
    if not request.question or not request.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User question cannot be empty.",
        )

    # 1. Build real-data context
    context = ai_context_service.build_solar_ai_context(db=db, device_id=request.device_id)

    # 2. Generate grounded response through active AI provider
    provider = get_ai_provider()
    response = provider.generate_response(context=context, question=request.question.strip())

    return response


@router.get("/status")
def get_ai_assistant_status():
    """
    Returns AI Assistant configuration, active provider, and grounding constraints.
    """
    has_gemini = bool(os.environ.get("GEMINI_API_KEY"))
    has_openai = bool(os.environ.get("OPENAI_API_KEY"))
    active_prov = "gemini-1.5-flash" if has_gemini else ("openai-gpt-4o" if has_openai else "solarai-grounded-engine")

    return {
        "status": "ready",
        "active_provider": active_prov,
        "external_llm_configured": has_gemini or has_openai,
        "fallback_provider": "solarai-grounded-engine",
        "grounding_rules": [
            "Use SolarAI context as primary source",
            "Never invent sensor readings, alerts, or predictions",
            "Distinguish measured vs predicted vs diagnostic inferences",
            "Explicitly disclose unavailable data",
            "Keep API keys strictly server-side",
        ],
        "required_env_vars": {
            "GEMINI_API_KEY": "Optional (enables Gemini 1.5 external LLM)",
            "OPENAI_API_KEY": "Optional (enables OpenAI external LLM)",
        },
    }
