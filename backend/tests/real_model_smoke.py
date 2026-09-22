"""Opt-in test of the running real-model backend. Creates one live employee prediction."""

from pathlib import Path

import httpx


def main():
    with httpx.Client(base_url="http://127.0.0.1:8000", timeout=90) as client:
        assert client.get("/api/health").json()["model"] == "loaded"
        login = client.post(
            "/api/auth/login", json={"email": "employee@visionops.local", "password": "EmployeeDemo!2026"}
        )
        login.raise_for_status()
        headers = {"Authorization": "Bearer " + login.json()["access_token"]}
        before = client.get("/api/analytics/overview?data=live", headers=headers).json()["total_requests"]
        samples = client.get("/api/samples", headers=headers).json()
        assert len(samples) >= 1
        image = client.get(samples[0]["url"], headers=headers).content
        response = client.post(
            "/api/predictions", headers=headers, files={"file": ("smoke.jpg", image, "image/jpeg")}
        )
        response.raise_for_status()
        p = response.json()
        assert not p["is_demo_data"] and p["inference_latency_ms"] > 0
        assert p["model_version"].startswith("yolo11n-")
        assert p["image_width"] > 0 and p["image_height"] > 0
        for d in p["detections"]:
            assert 0 <= d["x1"] <= d["x2"] <= p["image_width"] + 1
            assert 0 <= d["y1"] <= d["y2"] <= p["image_height"] + 1
        assert (
            client.get("/api/analytics/overview?data=live", headers=headers).json()["total_requests"]
            == before + 1
        )
        assert client.get(p["image_url"], headers=headers).status_code == 200
        feedback = client.post(
            f"/api/predictions/{p['id']}/feedback",
            headers=headers,
            json={
                "is_correct": False,
                "reason": "Other",
                "comment": "Integration smoke-test report; not a ground-truth judgment.",
            },
        )
        feedback.raise_for_status()
        admin = client.post(
            "/api/auth/login", json={"email": "admin@visionops.local", "password": "AdminDemo!2026"}
        ).json()
        admin_headers = {"Authorization": "Bearer " + admin["access_token"]}
        reports = client.get("/api/admin/reported-predictions", headers=admin_headers).json()
        assert any(report["id"] == p["id"] for report in reports)
        assert "visionops_predictions_total" in client.get("/metrics", headers=admin_headers).text
        print(
            f"PASS: real YOLO → storage → analytics increment → feedback → admin review → /metrics. {p['number_of_detections']} detections; {p['inference_latency_ms']:.1f} ms."
        )
        Path("data/last-smoke-prediction.txt").write_text(p["id"])


if __name__ == "__main__":
    main()
