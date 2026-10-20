from typing import Optional
from fastapi import Header, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings


def verify_device_token(
    x_device_token: Optional[str] = Header(None, alias=settings.DEVICE_TOKEN_HEADER)
) -> Optional[str]:
    """
    Validates edge ESP32 authentication token when requirement is enabled.
    """
    if settings.REQUIRE_DEVICE_TOKEN:
        if not x_device_token or x_device_token != settings.API_SECRET_KEY:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing X-Device-Token authentication header.",
            )
    return x_device_token
