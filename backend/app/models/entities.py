import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utcnow():
    return datetime.now(timezone.utc)


def new_id():
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str | None] = mapped_column(String(254), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str | None] = mapped_column(String(512), nullable=True)
    role: Mapped[str] = mapped_column(String(16), default="GUEST")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Prediction(Base):
    __tablename__ = "predictions"
    __table_args__ = (Index("ix_predictions_user_created", "user_id", "created_at"),)
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    model_name: Mapped[str] = mapped_column(String(80), default="YOLO11n")
    model_version: Mapped[str] = mapped_column(String(160))
    input_source: Mapped[str] = mapped_column(String(20), default="upload")
    original_image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    original_filename: Mapped[str] = mapped_column(String(255), default="image.jpg")
    image_width: Mapped[int] = mapped_column(Integer, default=0)
    image_height: Mapped[int] = mapped_column(Integer, default=0)
    number_of_detections: Mapped[int] = mapped_column(Integer, default=0)
    average_confidence: Mapped[float] = mapped_column(Float, default=0)
    max_confidence: Mapped[float] = mapped_column(Float, default=0)
    confidence_threshold: Mapped[float] = mapped_column(Float, default=0.25)
    inference_latency_ms: Mapped[float] = mapped_column(Float, default=0)
    total_latency_ms: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(20), default="success", index=True)
    error_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    is_demo_data: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    user: Mapped[User] = relationship()
    detections: Mapped[list["Detection"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    feedback: Mapped[list["PredictionFeedback"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class Detection(Base):
    __tablename__ = "detections"
    id: Mapped[int] = mapped_column(primary_key=True)
    prediction_id: Mapped[str] = mapped_column(ForeignKey("predictions.id"), index=True)
    class_name: Mapped[str] = mapped_column(String(80), index=True)
    class_id: Mapped[int] = mapped_column(Integer)
    confidence: Mapped[float] = mapped_column(Float)
    x1: Mapped[float] = mapped_column(Float)
    y1: Mapped[float] = mapped_column(Float)
    x2: Mapped[float] = mapped_column(Float)
    y2: Mapped[float] = mapped_column(Float)


class PredictionFeedback(Base):
    __tablename__ = "prediction_feedback"
    id: Mapped[int] = mapped_column(primary_key=True)
    prediction_id: Mapped[str] = mapped_column(ForeignKey("predictions.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    is_correct: Mapped[bool] = mapped_column(Boolean)
    reason: Mapped[str | None] = mapped_column(String(80), nullable=True)
    comment: Mapped[str] = mapped_column(Text, default="")
    review_status: Mapped[str] = mapped_column(String(30), default="pending")
    review_note: Mapped[str] = mapped_column(Text, default="")
    reviewed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class GeneralFeedback(Base):
    __tablename__ = "general_feedback"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    rating: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(80))
    message: Mapped[str] = mapped_column(Text)
    prediction_id: Mapped[str | None] = mapped_column(ForeignKey("predictions.id"), nullable=True)
