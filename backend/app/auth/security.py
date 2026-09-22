from datetime import timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.entities import User, utcnow

password_hasher = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)
Db = Annotated[Session, Depends(get_db)]


def create_token(user: User):
    now = utcnow()
    return jwt.encode(
        {"sub": user.id, "iat": now, "exp": now + timedelta(minutes=settings.jwt_expiry_minutes)},
        settings.jwt_secret,
        algorithm="HS256",
    )


def current_user(db: Db, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    try:
        if not credentials:
            raise ValueError()
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"require": ["sub", "exp", "iat"]},
        )
        user = db.get(User, payload["sub"])
        if not user:
            raise ValueError()
        return user
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(401, "Your session has expired. Please sign in again.") from None


CurrentUser = Annotated[User, Depends(current_user)]


def employee(user: CurrentUser):
    if user.role not in {"EMPLOYEE", "ADMIN"}:
        raise HTTPException(403, "Sign in as an employee to access this feature.")
    return user


def admin(user: CurrentUser):
    if user.role != "ADMIN":
        raise HTTPException(403, "This feature is available to administrators only.")
    return user


Employee = Annotated[User, Depends(employee)]
Admin = Annotated[User, Depends(admin)]


def public_user(user):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}
