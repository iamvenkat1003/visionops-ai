from sqlalchemy import select

from app.auth.security import password_hasher
from app.core.config import settings
from app.models.entities import User


def seed_users(db):
    if not settings.seed_demo_users:
        return
    for email, name, role, password in [
        ("employee@visionops.local", "Alex Morgan", "EMPLOYEE", settings.demo_employee_password),
        ("admin@visionops.local", "Jordan Lee", "ADMIN", settings.demo_admin_password),
    ]:
        if not db.scalar(select(User).where(User.email == email)):
            db.add(User(email=email, name=name, role=role, password_hash=password_hasher.hash(password)))
    db.commit()
