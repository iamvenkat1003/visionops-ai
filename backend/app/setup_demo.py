"""Download attributed Commons assets and seed actual inference with illustrative dates.

No training. No invented model metrics. Reset affects only records with input_source=seed.
"""

import argparse
import html
import json
import re
from datetime import timedelta
from io import BytesIO
from pathlib import Path
from time import perf_counter, sleep

import httpx
from PIL import Image, ImageOps
from sqlalchemy import delete, select

from app.core.config import settings
from app.db.seed import seed_users
from app.db.session import Base, SessionLocal, engine
from app.ml.service import model_service
from app.models.entities import Detection, GeneralFeedback, Prediction, PredictionFeedback, User, utcnow
from app.services.samples import sample_manifest
from app.services.storage import storage

TERMS = [
    ("Urban street", 'intitle:"street" intitle:"cars" filetype:bitmap'),
    ("A dog’s day", 'intitle:"Golden retriever" filetype:bitmap'),
    ("Cat portrait", 'intitle:"domestic cat" filetype:bitmap'),
    ("City bicycle", 'intitle:"bicycle" filetype:bitmap'),
    ("People outdoors", 'intitle:"people walking" filetype:bitmap'),
    ("Living space", 'intitle:"living room" filetype:bitmap'),
    ("Coffee break", 'intitle:"coffee cup" filetype:bitmap'),
    ("Everyday objects", 'intitle:"bottles" filetype:bitmap'),
    ("At the table", 'intitle:"dining table" filetype:bitmap'),
    ("Parked cars", 'intitle:"parked cars" filetype:bitmap'),
]


def clean(value):
    return html.unescape(re.sub("<[^>]+>", "", value)).strip()


def download_samples():
    root = settings.data_dir / "samples"
    root.mkdir(parents=True, exist_ok=True)
    existing = sample_manifest()
    if len(existing) >= 20 and all((root / f"{s['id']}.jpg").exists() for s in existing):
        print(f"Using {len(existing)} existing licensed samples.")
        return existing
    groups = []
    seen = set()
    headers = {
        "User-Agent": "VisionOpsAI-LocalDemo/1.0 (educational computer-vision demo; Wikimedia API client)"
    }
    pinned = Path(__file__).resolve().parents[2] / "demo_assets" / "ATTRIBUTION.json"
    if pinned.is_file():
        # Reproduce the reviewed collection on fresh clones rather than searching again.
        samples = []
        with httpx.Client(timeout=45, follow_redirects=True, headers=headers) as client:
            for sample in json.loads(pinned.read_text()):
                try:
                    destination = root / f"{sample['id']}.jpg"
                    if not destination.exists():
                        response = client.get(
                            "https://commons.wikimedia.org/w/api.php",
                            params={
                                "action": "query",
                                "format": "json",
                                "pageids": sample["id"].removeprefix("commons-"),
                                "prop": "imageinfo",
                                "iiprop": "url",
                                "iiurlwidth": 1280,
                            },
                        )
                        response.raise_for_status()
                        info = next(iter(response.json()["query"]["pages"].values()))["imageinfo"][0]
                        photo = client.get(info.get("thumburl", info["url"]))
                        photo.raise_for_status()
                        image = ImageOps.exif_transpose(Image.open(BytesIO(photo.content))).convert("RGB")
                        image.thumbnail((1280, 1280))
                        image.save(destination, quality=92)
                        sleep(0.2)
                    samples.append(sample)
                except (httpx.HTTPError, OSError, ValueError, KeyError) as exc:
                    print(f"Optional sample unavailable: {sample['id']}: {type(exc).__name__}", flush=True)
        (root / "manifest.json").write_text(json.dumps(samples, indent=2, ensure_ascii=False))
        print(f"Prepared {len(samples)} pinned sample assets.", flush=True)
        return samples
    with httpx.Client(timeout=45, follow_redirects=True, headers=headers) as client:
        for title, query in TERMS:
            selected = []
            try:
                response = client.get(
                    "https://commons.wikimedia.org/w/api.php",
                    params={
                        "action": "query",
                        "format": "json",
                        "generator": "search",
                        "gsrsearch": query,
                        "gsrnamespace": 6,
                        "gsrlimit": 12,
                        "prop": "imageinfo",
                        "iiprop": "url|extmetadata|size",
                        "iiurlwidth": 1280,
                    },
                )
                response.raise_for_status()
                pages = sorted(
                    response.json().get("query", {}).get("pages", {}).values(),
                    key=lambda p: p.get("index", 0),
                )
                for page in pages:
                    info = page.get("imageinfo", [{}])[0]
                    meta = info.get("extmetadata", {})
                    license_name = clean(meta.get("LicenseShortName", {}).get("value", ""))
                    if not (license_name.startswith("CC BY") or license_name in {"CC0", "Public domain"}):
                        continue
                    if (
                        "NC" in license_name
                        or "ND" in license_name
                        or info.get("width", 0) < 400
                        or info.get("height", 0) < 250
                    ):
                        continue
                    source = info.get("descriptionurl", "")
                    if not source or source in seen:
                        continue
                    try:
                        photo = client.get(info.get("thumburl", info["url"]))
                        photo.raise_for_status()
                        image = ImageOps.exif_transpose(Image.open(BytesIO(photo.content))).convert("RGB")
                        image.thumbnail((1280, 1280))
                        sid = f"commons-{page['pageid']}"
                        image.save(root / f"{sid}.jpg", quality=92)
                        selected.append(
                            {
                                "id": sid,
                                "title": title,
                                "credit": clean(
                                    meta.get("Artist", {}).get("value", "Wikimedia Commons contributor")
                                ),
                                "license": license_name,
                                "license_url": meta.get("LicenseUrl", {}).get(
                                    "value", "https://commons.wikimedia.org/wiki/Commons:Licensing"
                                ),
                                "source": source,
                                "original_title": page["title"],
                                "download_url": info["url"],
                                "changes": "Resized to at most 1280 pixels, EXIF stripped, converted to JPEG.",
                            }
                        )
                        seen.add(source)
                        print(f"Downloaded {title}: {sid} ({license_name})", flush=True)
                        sleep(0.2)
                        if len(selected) == 2:
                            break
                    except (httpx.HTTPError, OSError, ValueError) as exc:
                        print(f"Skipping unavailable image: {type(exc).__name__}", flush=True)
                groups.append(selected)
            except (httpx.HTTPError, ValueError) as exc:
                print(f"Optional sample group unavailable: {title}: {type(exc).__name__}", flush=True)
    samples = [group[i] for i in range(2) for group in groups if len(group) > i]
    if not samples:
        print("No samples available. The application still supports your own uploads.")
        return existing
    (root / "manifest.json").write_text(json.dumps(samples, indent=2, ensure_ascii=False))
    # The manifest contains public attribution only; images themselves stay in ignored runtime storage.
    attribution = Path(__file__).resolve().parents[1] / ".." / "demo_assets" / "ATTRIBUTION.json"
    attribution.parent.mkdir(exist_ok=True)
    attribution.write_text(json.dumps(samples, indent=2, ensure_ascii=False))
    return samples


def seed_history(samples, reset=False):
    with SessionLocal() as db:
        seed_users(db)
        if reset:
            old = db.scalars(select(Prediction).where(Prediction.input_source == "seed")).all()
            for p in old:
                db.execute(delete(GeneralFeedback).where(GeneralFeedback.prediction_id == p.id))
                if p.original_image_path:
                    (storage.root / p.original_image_path).unlink(missing_ok=True)
                db.delete(p)
            db.commit()
        if db.scalar(select(Prediction).where(Prediction.input_source == "seed")):
            print("Seed history already exists. Use --reset to replace only seeded history.")
            return
        if not samples:
            return
        model_service.load()
        if model_service.health()["status"] != "loaded":
            raise SystemExit(
                "Seeding requires real YOLO11n: set DEMO_MODE=false and run python -m app.setup_model."
            )
        employee = db.scalar(select(User).where(User.email == "employee@visionops.local"))
        admin = db.scalar(select(User).where(User.email == "admin@visionops.local"))
        if not employee or not admin:
            raise SystemExit("Enable SEED_DEMO_USERS to seed demo history.")
        guest = User(name="Sample guest session", role="GUEST")
        db.add(guest)
        db.flush()
        for i, sample in enumerate(samples):
            start = perf_counter()
            image = Image.open(settings.data_dir / "samples" / f"{sample['id']}.jpg").convert("RGB")
            owner = employee if i < 14 else admin if i < 18 else guest
            key = storage.save(image)
            boxes, latency = model_service.predict(image, settings.confidence_threshold)
            created = utcnow() - timedelta(hours=(len(samples) - i - 1) * 7 + 1, minutes=(i * 13) % 60)
            p = Prediction(
                user_id=owner.id,
                created_at=created,
                model_version=model_service.version,
                input_source="seed",
                original_image_path=key,
                original_filename=f"{sample['title']} — {sample['id']}.jpg",
                image_width=image.width,
                image_height=image.height,
                number_of_detections=len(boxes),
                average_confidence=sum(b["confidence"] for b in boxes) / len(boxes) if boxes else 0,
                max_confidence=max((b["confidence"] for b in boxes), default=0),
                confidence_threshold=settings.confidence_threshold,
                inference_latency_ms=latency,
                total_latency_ms=(perf_counter() - start) * 1000,
                status="success",
                is_demo_data=True,
                detections=[Detection(**b) for b in boxes],
            )
            db.add(p)
            db.flush()
            if i in {1, 5, 9}:
                db.add(
                    PredictionFeedback(
                        prediction_id=p.id,
                        user_id=owner.id,
                        created_at=created + timedelta(minutes=3),
                        is_correct=False,
                        reason="Missed object",
                        comment="Illustrative demo feedback. Please inspect the image; this is not ground truth.",
                    )
                )
            print(
                f"Seeded {sample['title']}: {len(boxes)} objects, {latency:.1f} ms real inference", flush=True
            )
        db.commit()
        print(
            f"Seeded {len(samples)} real-model predictions, with demo provenance and illustrative historical dates."
        )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--reset", action="store_true", help="Replace ONLY seeded history; keep all live predictions."
    )
    parser.add_argument(
        "--offline", action="store_true", help="Use existing sample files without downloading."
    )
    args = parser.parse_args()
    settings.prepare()
    Base.metadata.create_all(engine)
    samples = sample_manifest() if args.offline else download_samples()
    seed_history(samples, args.reset)


if __name__ == "__main__":
    main()
