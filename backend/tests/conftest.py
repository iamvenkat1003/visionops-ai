import os
import tempfile

root = tempfile.mkdtemp(prefix="visionops-tests-")
os.environ.update(
    DATABASE_URL=f"sqlite:///{root}/test.db",
    DATA_DIR=root,
    DEMO_MODE="true",
    JWT_SECRET="test-only-secret-do-not-deploy-32-characters",
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as client:
        yield client


@pytest.fixture
def employee(client):
    r = client.post(
        "/api/auth/login", json={"email": "employee@visionops.local", "password": "EmployeeDemo!2026"}
    )
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@visionops.local", "password": "AdminDemo!2026"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def guest(client):
    r = client.post("/api/auth/guest")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
