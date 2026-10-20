from fastapi import APIRouter
from app.api.v1.telemetry import router as telemetry_router
from app.api.v1.devices import router as devices_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.predictions import router as predictions_router
from app.api.v1.health import router as health_router
from app.api.v1.model_metrics import router as model_metrics_router

api_v1_router = APIRouter()
api_v1_router.include_router(telemetry_router)
api_v1_router.include_router(devices_router)
api_v1_router.include_router(alerts_router)
api_v1_router.include_router(predictions_router)
api_v1_router.include_router(health_router)
api_v1_router.include_router(model_metrics_router)
