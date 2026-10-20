from fastapi import APIRouter
from app.api.v1.telemetry import router as telemetry_router
from app.api.v1.devices import router as devices_router

api_v1_router = APIRouter()
api_v1_router.include_router(telemetry_router)
api_v1_router.include_router(devices_router)
