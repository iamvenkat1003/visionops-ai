from datetime import timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.models.entities import Prediction


def iso(value):
    return value.replace(tzinfo=timezone.utc).isoformat() if value else None


def feedback_dict(f):
    return {
        "id": f.id,
        "prediction_id": f.prediction_id,
        "user_id": f.user_id,
        "created_at": iso(f.created_at),
        "is_correct": f.is_correct,
        "reason": f.reason,
        "comment": f.comment,
        "review_status": f.review_status,
        "review_note": f.review_note,
        "reviewed_at": iso(f.reviewed_at),
    }


def serialize(p):
    return {
        "id": p.id,
        "user_id": p.user_id,
        "user_name": p.user.name,
        "role": p.user.role,
        "created_at": iso(p.created_at),
        "model_name": p.model_name,
        "model_version": p.model_version,
        "input_source": p.input_source,
        "original_filename": p.original_filename,
        "image_width": p.image_width,
        "image_height": p.image_height,
        "number_of_detections": p.number_of_detections,
        "average_confidence": p.average_confidence,
        "max_confidence": p.max_confidence,
        "confidence_threshold": p.confidence_threshold,
        "inference_latency_ms": p.inference_latency_ms,
        "total_latency_ms": p.total_latency_ms,
        "status": p.status,
        "error_type": p.error_type,
        "is_demo_data": p.is_demo_data,
        "image_url": f"/api/predictions/{p.id}/image" if p.original_image_path else None,
        "detections": [
            {k: getattr(d, k) for k in ["id", "class_name", "class_id", "confidence", "x1", "y1", "x2", "y2"]}
            for d in p.detections
        ],
        "feedback": [feedback_dict(f) for f in p.feedback],
    }


def get_permitted(db, prediction_id, user):
    p = db.scalar(
        select(Prediction).options(joinedload(Prediction.user)).where(Prediction.id == prediction_id)
    )
    if not p or (user.role != "ADMIN" and p.user_id != user.id):
        raise HTTPException(404, "Prediction not found.")
    return p
