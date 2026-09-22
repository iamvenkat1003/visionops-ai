import logging
import secrets
from contextlib import asynccontextmanager
from time import perf_counter

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool

from app.api import auth, observability, predictions, samples
from app.auth.security import bearer, current_user
from app.core import telemetry
from app.core.config import settings
from app.core.upload_limit import UploadLimitMiddleware
from app.db.seed import seed_users
from app.db.session import Base, SessionLocal, engine, get_db
from app.ml.service import model_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app):
    settings.prepare()
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_users(db)
    await run_in_threadpool(model_service.load)
    yield


app = FastAPI(
    title="VisionOps AI",
    version="1.0.0",
    lifespan=lifespan,
    description="Computer Vision Intelligence & Observability. Bearer authentication; server-enforced RBAC.",
)
app.add_middleware(UploadLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def instrument(request: Request, call_next):
    start = perf_counter()
    request.state.started = start
    try:
        response = await call_next(request)
    except Exception:
        log.exception("Unhandled request error")
        response = JSONResponse(
            {"detail": "Something went wrong. Please try again shortly."}, status_code=500
        )
    route = getattr(request.scope.get("route"), "path", "unmatched")
    telemetry.requests.labels(request.method, route, str(response.status_code)).inc()
    telemetry.request_latency.labels(route).observe(perf_counter() - start)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse(
        {"detail": "Some fields are missing or invalid. Please check your input."}, status_code=422
    )


@app.exception_handler(SQLAlchemyError)
async def database_error(request, exc):
    log.error("Database operation failed", exc_info=exc)
    return JSONResponse(
        {"detail": "The database is temporarily unavailable. Please try again."}, status_code=503
    )


@app.get("/metrics", tags=["Telemetry"])
def metrics(credentials=Depends(bearer), db=Depends(get_db)):
    token = credentials.credentials if credentials else ""
    if not (settings.metrics_token and secrets.compare_digest(token, settings.metrics_token)):
        user = current_user(db, credentials)
        if user.role != "ADMIN":
            raise HTTPException(403, "Administrator access is required.")
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


app.include_router(auth.router)
app.include_router(predictions.router)
app.include_router(observability.router)
app.include_router(samples.router)
