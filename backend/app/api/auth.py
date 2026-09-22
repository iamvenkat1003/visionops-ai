from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.auth.security import CurrentUser, Db, create_token, password_hasher, public_user
from app.models.entities import User, utcnow
from app.schemas.inputs import LoginInput

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
# Equal-cost verification for unknown accounts avoids a simple timing oracle.
dummy_hash = password_hasher.hash("not-a-real-account")


@router.post("/login")
def login(data: LoginInput, db: Db):
    user = db.scalar(select(User).where(User.email == data.email.strip().lower()))
    valid = password_hasher.verify(
        data.password, user.password_hash if user and user.password_hash else dummy_hash
    )
    if not user or not valid:
        raise HTTPException(401, "The email or password is incorrect.")
    user.last_active_at = utcnow()
    db.commit()
    return {"access_token": create_token(user), "token_type": "bearer", "user": public_user(user)}


@router.post("/guest")
def guest(db: Db):
    user = User(name="Guest explorer", role="GUEST")
    db.add(user)
    db.commit()
    return {"access_token": create_token(user), "token_type": "bearer", "user": public_user(user)}


@router.get("/me")
def me(user: CurrentUser):
    return public_user(user)
