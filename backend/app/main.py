from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
import app.models  # Register all models on Base.metadata
from app.api.v1.router import api_v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    Base.metadata.create_all(bind=engine)
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
