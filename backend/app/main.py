from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
import app.models  # Register all models on Base.metadata
from app.api.v1.router import api_v1_router


def ensure_schema_compatibility():
    with engine.connect() as conn:
        try:
            res = conn.exec_driver_sql("PRAGMA table_info(alerts)").fetchall()
            if res:
                existing_cols = {r[1] for r in res}
                new_cols = [
                    ("alert_type", "VARCHAR(64)"),
                    ("metric_name", "VARCHAR(64)"),
                    ("metric_value", "FLOAT"),
                    ("expected_value", "FLOAT"),
                    ("unit", "VARCHAR(32)"),
                    ("recommended_action", "TEXT"),
                ]
                for col_name, col_type in new_cols:
                    if col_name not in existing_cols:
                        conn.exec_driver_sql(f"ALTER TABLE alerts ADD COLUMN {col_name} {col_type}")
                conn.commit()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility()
    yield
    # Cleanup on shutdown if needed


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS Middleware for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 API routes
app.include_router(api_v1_router, prefix=settings.API_V1_STR)


@app.get(
    "/",
    tags=["Root & System Health"],
    summary="API Root Information",
    description="Returns service metadata, health status, and documentation endpoints."
)
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "ONLINE",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "telemetry_endpoint": f"{settings.API_V1_STR}/telemetry",
    }


@app.get(
    "/health",
    tags=["Root & System Health"],
    summary="System Healthcheck",
    status_code=status.HTTP_200_OK,
)
def healthcheck():
    return {
        "status": "healthy",
        "database": "connected",
        "version": settings.VERSION,
    }
