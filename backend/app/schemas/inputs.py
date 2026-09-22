from typing import Literal

from pydantic import BaseModel, Field


class LoginInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class PredictionFeedbackInput(BaseModel):
    is_correct: bool
    reason: (
        Literal[
            "Missed object",
            "Wrong class",
            "Incorrect bounding box",
            "Low confidence",
            "Duplicate detection",
            "Other",
        ]
        | None
    ) = None
    comment: str = Field(default="", max_length=2000)


class GeneralFeedbackInput(BaseModel):
    rating: int = Field(ge=1, le=5)
    category: Literal["Incorrect prediction", "UI issue", "Performance issue", "Feature request", "Other"]
    message: str = Field(min_length=5, max_length=3000)
    prediction_id: str | None = Field(default=None, max_length=32)


class ReviewInput(BaseModel):
    status: Literal["reviewed", "dataset_candidate", "dismissed"]
    note: str = Field(default="", max_length=2000)
