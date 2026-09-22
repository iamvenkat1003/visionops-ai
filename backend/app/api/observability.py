from datetime import timedelta
from time import monotonic
from typing import Literal

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select, text

from app.auth.security import Admin, Db, Employee, public_user
from app.ml.service import model_service
from app.models.entities import GeneralFeedback, Prediction, PredictionFeedback, User, utcnow
from app.schemas.inputs import GeneralFeedbackInput, ReviewInput
from app.services.analytics import calculate
from app.services.predictions import feedback_dict, get_permitted, iso, serialize

router = APIRouter(tags=["Observability & review"])
started = monotonic()


@router.get("/api/health")
def health(db: Db):
    try:
        db.execute(text("SELECT 1"))
        database = "connected"
    except Exception:
        database = "unavailable"
    model = model_service.health()
    return {
        "status": "healthy"
        if database == "connected" and model["status"] in {"loaded", "demo"}
        else "degraded",
        "api": "healthy",
        "model": model["status"],
        "database": database,
        "demo_mode": model["demo_mode"],
    }


@router.get("/api/analytics/overview")
def analytics(
    user: Employee,
    db: Db,
    window: Literal["1h", "24h", "7d", "30d", "all"] = "7d",
    data: Literal["all", "live", "demo"] = "all",
):
    return calculate(db, user, window, data)


@router.get("/api/model/info")
def model_info(user: Employee):
    return model_service.health()


@router.get("/api/model/performance")
def model_performance(user: Employee, db: Db):
    query = select(PredictionFeedback).join(Prediction, PredictionFeedback.prediction_id == Prediction.id)
    if user.role != "ADMIN":
        query = query.where(Prediction.user_id == user.id)
    # Demo judgments do not count as real application quality evidence.
    rows = db.scalars(query.where(Prediction.is_demo_data.is_(False))).all()
    return {
        **model_service.health(),
        "published": {
            "map50_95": 0.395,
            "map50": None,
            "precision": None,
            "recall": None,
            "parameters_millions": 2.6,
            "dataset": "COCO val2017",
            "source": "https://docs.ultralytics.com/models/yolo11/",
            "input_size": 640,
        },
        "application": {
            "evaluated_images": 0,
            "map50": None,
            "map50_95": None,
            "precision": None,
            "recall": None,
            "feedback_count": len(rows),
            "correct_reports": sum(f.is_correct for f in rows),
            "incorrect_reports": sum(not f.is_correct for f in rows),
        },
    }


@router.post("/api/feedback", status_code=201)
def submit_feedback(data: GeneralFeedbackInput, user: Employee, db: Db):
    if data.prediction_id:
        get_permitted(db, data.prediction_id, user)
    feedback = GeneralFeedback(user_id=user.id, **data.model_dump())
    db.add(feedback)
    db.commit()
    return {"id": feedback.id, "message": "Thanks. Your feedback has been sent for review."}


@router.get("/api/admin/users")
def users(user: Admin, db: Db):
    rows = db.execute(
        select(User, func.count(Prediction.id))
        .outerjoin(Prediction)
        .group_by(User.id)
        .order_by(User.created_at.desc())
        .limit(200)
    ).all()
    return [
        {
            **public_user(u),
            "created_at": iso(u.created_at),
            "last_active_at": iso(u.last_active_at),
            "predictions": count,
        }
        for u, count in rows
    ]


@router.get("/api/admin/feedback")
def all_feedback(user: Admin, db: Db):
    rows = db.execute(
        select(GeneralFeedback, User).join(User).order_by(GeneralFeedback.created_at.desc()).limit(200)
    ).all()
    return [
        {
            "id": f.id,
            "user_name": u.name,
            "created_at": iso(f.created_at),
            "category": f.category,
            "rating": f.rating,
            "message": f.message,
            "prediction_id": f.prediction_id,
        }
        for f, u in rows
    ]


@router.get("/api/admin/reported-predictions")
def reported(user: Admin, db: Db):
    rows = db.scalars(
        select(Prediction)
        .where(Prediction.feedback.any(PredictionFeedback.is_correct.is_(False)))
        .order_by(Prediction.created_at.desc())
        .limit(200)
    ).all()
    return [serialize(p) for p in rows]


@router.patch("/api/admin/prediction-feedback/{feedback_id}")
def review(feedback_id: int, data: ReviewInput, user: Admin, db: Db):
    f = db.get(PredictionFeedback, feedback_id)
    if not f:
        raise HTTPException(404, "Feedback not found.")
    f.review_status, f.review_note = data.status, data.note
    f.reviewed_by, f.reviewed_at = user.id, utcnow()
    db.commit()
    return feedback_dict(f)


@router.get("/api/admin/system")
def system(user: Admin, db: Db):
    metrics = calculate(db, user, "24h", "live")
    today = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    return {
        **health(db),
        "model_info": model_service.health(),
        "uptime_seconds": round(monotonic() - started),
        "total_users": db.scalar(select(func.count(User.id))),
        "recent_users": db.scalar(
            select(func.count(User.id)).where(User.last_active_at >= utcnow() - timedelta(days=1))
        ),
        "total_predictions": db.scalar(select(func.count(Prediction.id))),
        "predictions_today": db.scalar(
            select(func.count(Prediction.id)).where(Prediction.created_at >= today)
        ),
        "feedback_count": db.scalar(select(func.count(GeneralFeedback.id))),
        "incorrect_reports": db.scalar(
            select(func.count(PredictionFeedback.id)).where(PredictionFeedback.is_correct.is_(False))
        ),
        "metrics": metrics,
    }
