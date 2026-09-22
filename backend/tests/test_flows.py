from io import BytesIO

import jwt
import pytest
from PIL import Image

from app.services.analytics import percentile


def picture():
    stream = BytesIO()
    Image.new("RGB", (320, 240), "steelblue").save(stream, format="PNG")
    return ("test.png", stream.getvalue(), "image/png")


def test_auth_and_health(client, guest, employee, admin):
    assert client.get("/api/health").json()["model"] == "demo"
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer invalid"}).status_code == 401
    assert (
        client.post("/api/auth/login", json={"email": "missing@example.com", "password": "wrong"}).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login", json={"email": "employee@visionops.local", "password": "wrong"}
        ).status_code
        == 401
    )
    assert client.get("/api/auth/me", headers=employee).json()["role"] == "EMPLOYEE"
    assert client.get("/api/auth/me", headers=guest).json()["role"] == "GUEST"
    assert client.get("/api/admin/users", headers=admin).status_code == 200
    assert "password_hash" not in str(client.get("/api/admin/users", headers=admin).json())


@pytest.mark.parametrize(
    "route",
    [
        "/api/predictions",
        "/api/analytics/overview",
        "/api/model/performance",
        "/api/model/info",
        "/api/admin/system",
        "/api/admin/users",
        "/api/admin/feedback",
        "/api/admin/reported-predictions",
        "/metrics",
    ],
)
def test_guest_permissions(client, guest, route):
    assert client.get(route, headers=guest).status_code == 403
    assert client.get(route).status_code == 401


def test_employee_not_admin(client, employee):
    for route in [
        "/api/admin/users",
        "/api/admin/system",
        "/api/admin/feedback",
        "/api/admin/reported-predictions",
        "/metrics",
    ]:
        assert client.get(route, headers=employee).status_code == 403


def test_prediction_review_workflow(client, employee, admin, guest):
    before = client.get("/api/analytics/overview", headers=employee).json()["total_requests"]
    r = client.post("/api/predictions", headers=employee, files={"file": picture()})
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["is_demo_data"] and p["image_width"] == 320
    assert len(p["detections"]) == 1 and p["detections"][0]["x2"] == 224
    assert client.get(f"/api/predictions/{p['id']}", headers=employee).status_code == 200
    assert (
        client.get(f"/api/predictions/{p['id']}/image", headers=employee).headers["content-type"]
        == "image/jpeg"
    )
    assert client.get(f"/api/predictions/{p['id']}", headers=guest).status_code == 404
    assert client.get(f"/api/predictions/{p['id']}/image", headers=guest).status_code == 404
    assert client.get("/api/predictions", headers=employee).json()["total"] >= 1
    result = client.post(
        f"/api/predictions/{p['id']}/feedback",
        headers=employee,
        json={"is_correct": False, "reason": "Wrong class", "comment": "Please review."},
    )
    assert result.status_code == 201
    feedback_id = result.json()["feedback"][0]["id"]
    assert (
        client.post(
            f"/api/predictions/{p['id']}/feedback", headers=guest, json={"is_correct": True}
        ).status_code
        == 403
    )
    reports = client.get("/api/admin/reported-predictions", headers=admin).json()
    assert p["id"] in [report["id"] for report in reports]
    reviewed = client.patch(
        f"/api/admin/prediction-feedback/{feedback_id}",
        headers=admin,
        json={"status": "dataset_candidate", "note": "Needs corrected labels first."},
    )
    assert reviewed.json()["review_status"] == "dataset_candidate"
    assert client.get("/api/predictions?feedback=incorrect", headers=employee).json()["total"] >= 1
    metrics = client.get("/api/analytics/overview", headers=employee).json()
    assert metrics["total_requests"] == before + 1 and metrics["classes"][0]["name"] == "person"
    assert client.get("/api/analytics/overview?data=live", headers=employee).json()["total_requests"] == 0
    assert "visionops_inference_latency_seconds_bucket" in client.get("/metrics", headers=admin).text


def test_guest_analysis_is_private(client, guest, employee):
    p = client.post("/api/predictions", headers=guest, files={"file": picture()}).json()
    assert client.get(f"/api/predictions/{p['id']}", headers=guest).status_code == 200
    assert client.get(f"/api/predictions/{p['id']}", headers=employee).status_code == 404
    other = client.post("/api/auth/guest").json()["access_token"]
    assert (
        client.get(
            f"/api/predictions/{p['id']}/image", headers={"Authorization": f"Bearer {other}"}
        ).status_code
        == 404
    )


@pytest.mark.parametrize(
    "file,status",
    [
        (("bad.txt", b"hello", "text/plain"), 415),
        (("bad.png", b"not an image", "image/png"), 400),
        (("empty.png", b"", "image/png"), 400),
        (("big.png", b"x" * (10 * 1024 * 1024 + 1), "image/png"), 413),
    ],
)
def test_invalid_image(client, employee, file, status):
    assert client.post("/api/predictions", headers=employee, files={"file": file}).status_code == status


def test_general_feedback(client, employee, guest, admin):
    data = {"rating": 4, "category": "UI issue", "message": "Please improve the upload hint."}
    assert client.post("/api/feedback", headers=guest, json=data).status_code == 403
    assert client.post("/api/feedback", headers=employee, json=data).status_code == 201
    assert len(client.get("/api/admin/feedback", headers=admin).json()) >= 1
    assert client.get("/api/admin/system", headers=admin).json()["api"] == "healthy"
    quality = client.get("/api/model/performance", headers=employee).json()
    assert quality["published"]["map50_95"] == 0.395 and quality["application"]["map50_95"] is None


def test_percentiles():
    assert percentile([], 0.95) is None
    assert percentile([100], 0.95) == 100
    assert percentile([0, 100], 0.5) == 50
    assert percentile([0, 100], 0.95) == 95


def test_expired_token(client):
    from app.core.config import settings

    token = jwt.encode({"sub": "any", "iat": 1, "exp": 2}, settings.jwt_secret, algorithm="HS256")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_no_detections_is_success(client, employee):
    r = client.post(
        "/api/predictions", headers=employee, files={"file": picture()}, data={"threshold": ".95"}
    )
    assert r.status_code == 201
    assert r.json()["number_of_detections"] == 0
    assert r.json()["status"] == "success"


def test_model_unavailable_is_recorded_without_fake_results(client, employee, monkeypatch):
    from app.core.config import settings
    from app.ml.service import model_service

    monkeypatch.setattr(settings, "demo_mode", False)
    monkeypatch.setattr(model_service, "model", None)
    r = client.post("/api/predictions", headers=employee, files={"file": picture()})
    assert r.status_code == 503
    assert "Traceback" not in r.text
    rows = client.get("/api/predictions?status=error&data=live", headers=employee).json()["items"]
    assert rows[0]["error_type"] == "http_503"
    assert rows[0]["detections"] == []


def test_unhandled_inference_error_is_friendly(client, employee, monkeypatch):
    from app.ml.service import model_service

    def broken(*args):
        raise RuntimeError("private internal diagnostic")

    monkeypatch.setattr(model_service, "predict", broken)
    r = client.post("/api/predictions", headers=employee, files={"file": picture()})
    assert r.status_code == 503
    assert "private internal diagnostic" not in r.text


def test_second_employee_cannot_read_first_employee(client, employee):
    from app.auth.security import create_token
    from app.db.session import SessionLocal
    from app.models.entities import User

    with SessionLocal() as db:
        second = User(name="Second employee", email="second@visionops.local", role="EMPLOYEE")
        db.add(second)
        db.commit()
        other_headers = {"Authorization": "Bearer " + create_token(second)}
    p = client.post("/api/predictions", headers=employee, files={"file": picture()}).json()
    assert client.get("/api/predictions/" + p["id"], headers=other_headers).status_code == 404
    assert client.get("/api/predictions", headers=other_headers).json()["items"] == []
    assert (
        client.post(
            "/api/feedback",
            headers=other_headers,
            json={
                "rating": 3,
                "category": "Other",
                "message": "Invalid reference",
                "prediction_id": p["id"],
            },
        ).status_code
        == 404
    )


def test_multipart_body_limit(client, guest):
    r = client.post(
        "/api/predictions",
        headers=guest,
        files={"file": ("huge.jpg", b"x" * (11 * 1024 * 1024), "image/jpeg")},
    )
    assert r.status_code == 413


def test_optional_samples_do_not_break_app(client, guest):
    assert client.get("/api/samples", headers=guest).json() == []
    assert client.get("/api/samples/missing/image", headers=guest).status_code == 404


def test_feedback_validation_and_review_permissions(client, employee):
    p = client.post("/api/predictions", headers=employee, files={"file": picture()}).json()
    assert (
        client.post(
            "/api/predictions/" + p["id"] + "/feedback",
            headers=employee,
            json={"is_correct": False, "reason": "Invalid category"},
        ).status_code
        == 422
    )
    assert (
        client.patch(
            "/api/admin/prediction-feedback/1", headers=employee, json={"status": "reviewed"}
        ).status_code
        == 403
    )
