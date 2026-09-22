import logging
from datetime import datetime
from pathlib import Path
from time import perf_counter
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.auth.security import CurrentUser, Db, Employee
from app.core import telemetry
from app.core.config import settings
from app.ml.service import model_service
from app.models.entities import Detection, Prediction, PredictionFeedback, utcnow
from app.schemas.inputs import PredictionFeedbackInput
from app.services.predictions import get_permitted, serialize
from app.services.storage import storage, validate_image

router = APIRouter(prefix="/api/predictions", tags=["Predictions"])
log = logging.getLogger(__name__)


@router.post("", status_code=201)
def predict(
    request: Request,
    user: CurrentUser,
    db: Db,
    file: Annotated[UploadFile, File()],
    input_source: Annotated[Literal["upload", "camera", "sample"], Form()] = "upload",
    threshold: Annotated[float, Form(ge=0.05, le=0.95)] = settings.confidence_threshold,
):
    start = getattr(request.state, "started", perf_counter())
    p = Prediction(
        user_id=user.id,
        model_version=model_service.version,
        input_source=input_source,
        original_filename=Path(file.filename or "image.jpg").name[:255],
        confidence_threshold=threshold,
        is_demo_data=settings.demo_mode,
    )
    db.add(p)
    try:
        image = validate_image(
            file.file.read(settings.max_upload_mb * 1024 * 1024 + 1),
            file.filename or "",
            file.content_type or "",
        )
        p.image_width, p.image_height = image.size
        p.original_image_path = storage.save(image)
        if model_service.health()["status"] == "unavailable":
            raise HTTPException(
                503, "The model is unavailable. Please ask the administrator to check model setup."
            )
        boxes, p.inference_latency_ms = model_service.predict(image, threshold)
        p.detections = [Detection(**box) for box in boxes]
        p.number_of_detections = len(boxes)
        p.average_confidence = sum(b["confidence"] for b in boxes) / len(boxes) if boxes else 0
        p.max_confidence = max((b["confidence"] for b in boxes), default=0)
        p.status = "success"
        telemetry.inference_latency.observe(p.inference_latency_ms / 1000)
    except HTTPException as exc:
        p.status, p.error_type = "error", f"http_{exc.status_code}"
        p.total_latency_ms = (perf_counter() - start) * 1000
        db.commit()
        telemetry.predictions.labels("error", "demo" if p.is_demo_data else "live").inc()
        telemetry.prediction_errors.labels(p.error_type).inc()
        raise
    except Exception:
        log.exception("Inference failed")
        p.status, p.error_type = "error", "inference_error"
        p.total_latency_ms = (perf_counter() - start) * 1000
        db.commit()
        telemetry.predictions.labels("error", "demo" if p.is_demo_data else "live").inc()
        telemetry.prediction_errors.labels("inference_error").inc()
        raise HTTPException(
            503, "We couldn’t analyze this image. Please try again or contact an administrator."
        ) from None
    p.total_latency_ms = (perf_counter() - start) * 1000
    user.last_active_at = utcnow()
    db.commit()
    telemetry.predictions.labels("success", "demo" if p.is_demo_data else "live").inc()
    return serialize(p)


@router.get("")
def history(
    user: Employee,
    db: Db,
    search: str = "",
    class_name: str = "",
    min_confidence: float = Query(0, ge=0, le=1),
    max_confidence: float = Query(1, ge=0, le=1),
    status: Literal["all", "success", "error"] = "all",
    feedback: Literal["all", "correct", "incorrect", "none"] = "all",
    data: Literal["all", "live", "demo"] = "all",
    after: datetime | None = None,
    before: datetime | None = None,
    sort: Literal["newest", "oldest", "confidence", "latency"] = "newest",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = select(Prediction)
    if user.role != "ADMIN":
        query = query.where(Prediction.user_id == user.id)
    if search:
        query = query.where(
            Prediction.id.contains(search)
            | Prediction.original_filename.icontains(search)
            | Prediction.detections.any(Detection.class_name.icontains(search))
        )
    if class_name:
        query = query.where(Prediction.detections.any(Detection.class_name == class_name))
    query = query.where(Prediction.average_confidence.between(min_confidence, max_confidence))
    if status != "all":
        query = query.where(Prediction.status == status)
    if data != "all":
        query = query.where(Prediction.is_demo_data == (data == "demo"))
    if feedback in {"correct", "incorrect"}:
        query = query.where(Prediction.feedback.any(PredictionFeedback.is_correct == (feedback == "correct")))
    elif feedback == "none":
        query = query.where(~Prediction.feedback.any())
    if after:
        query = query.where(Prediction.created_at >= after)
    if before:
        query = query.where(Prediction.created_at <= before)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    ordering = {
        "newest": Prediction.created_at.desc(),
        "oldest": Prediction.created_at.asc(),
        "confidence": Prediction.average_confidence.desc(),
        "latency": Prediction.total_latency_ms.desc(),
    }
    items = db.scalars(
        query.options(joinedload(Prediction.user))
        .order_by(ordering[sort], Prediction.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {"items": [serialize(p) for p in items], "total": total, "page": page, "page_size": page_size}


@router.get("/{prediction_id}")
def detail(prediction_id: str, user: CurrentUser, db: Db):
    return serialize(get_permitted(db, prediction_id, user))


@router.get("/{prediction_id}/image")
def image(prediction_id: str, user: CurrentUser, db: Db):
    p = get_permitted(db, prediction_id, user)
    if not p.original_image_path:
        raise HTTPException(404, "No image is available for this request.")
    return FileResponse(
        storage.resolve(p.original_image_path),
        media_type="image/jpeg",
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.post("/{prediction_id}/feedback", status_code=201)
def feedback(prediction_id: str, data: PredictionFeedbackInput, user: Employee, db: Db):
    p = get_permitted(db, prediction_id, user)
    if p.status != "success":
        raise HTTPException(400, "Only completed predictions can be reviewed.")
    # Append-only human judgments preserve review history; no training is triggered here.
    db.add(
        PredictionFeedback(
            prediction_id=p.id,
            user_id=user.id,
            is_correct=data.is_correct,
            reason=data.reason if not data.is_correct else None,
            comment=data.comment,
        )
    )
    db.commit()
    db.refresh(p)
    return serialize(p)
