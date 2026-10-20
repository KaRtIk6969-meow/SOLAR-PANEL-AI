from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "SolarAI Telemetry API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    DESCRIPTION: str = (
        "Production-ready IoT Telemetry Ingestion and Analytics API for SolarAI. "
        "Receives sensor telemetry from ESP32 edge devices, validates physical ranges, "
        "computes power & efficiency, and powers real-time dashboard analytics."
    )

    # Environment & Database Configuration
    DATABASE_URL: str = "sqlite:///./solarai.db"
    
    # Security & Tokens
    API_SECRET_KEY: str = "solarai_super_secret_dev_key_change_in_production"
    DEVICE_TOKEN_HEADER: str = "X-Device-Token"
    REQUIRE_DEVICE_TOKEN: bool = False  # Allows unauthenticated ESP32 lab testing by default

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

    # Sensor Operational Boundaries (Physical bounds for PV testing)
    MIN_VOLTAGE_V: float = 0.0
    MAX_VOLTAGE_V: float = 60.0
    MIN_CURRENT_A: float = 0.0
    MAX_CURRENT_A: float = 30.0
    MIN_TEMPERATURE_C: float = -40.0
    MAX_TEMPERATURE_C: float = 125.0
    MIN_IRRADIANCE_W_M2: float = 0.0
    MAX_IRRADIANCE_W_M2: float = 2000.0

    # Device Heartbeat Status Thresholds (seconds)
    DEVICE_ONLINE_THRESHOLD_SEC: int = 60
    DEVICE_STALE_THRESHOLD_SEC: int = 180

    # Default PV panel parameters for efficiency derivation if unregistered
    DEFAULT_PANEL_AREA_M2: float = 0.65
    DEFAULT_RATED_POWER_W: float = 100.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
