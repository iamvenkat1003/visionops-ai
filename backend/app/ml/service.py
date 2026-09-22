"""One model per process. A lock protects Ultralytics' mutable predictor state."""

import hashlib
import logging
from abc import ABC, abstractmethod
from threading import Lock
from time import perf_counter

from PIL import Image

from app.core.config import settings

log = logging.getLogger(__name__)


class BaseModelService(ABC):
    @abstractmethod
    def load(self): ...

    @abstractmethod
    def predict(self, image: Image.Image, threshold: float) -> tuple[list[dict], float]: ...

    @abstractmethod
    def health(self) -> dict: ...


class YOLODetectionService(BaseModelService):
    def __init__(self):
        self.model = None
        self.version = "unavailable"
        self.lock = Lock()
        self.error = None

    def load(self):
        if settings.demo_mode:
            self.version = "demo-fixture-v1"
            return
        try:
            from ultralytics import YOLO, __version__

            if not settings.model_path.is_file():
                raise FileNotFoundError("Run python -m app.setup_model first.")
            digest = hashlib.sha256(settings.model_path.read_bytes()).hexdigest()[:12]
            model = YOLO(str(settings.model_path))
            model.predict(Image.new("RGB", (640, 640)), device=settings.model_device, verbose=False)
            self.model = model
            self.version = f"yolo11n-{digest} / ultralytics-{__version__}"
            self.error = None
        except Exception:
            log.exception("Model initialization failed")
            self.error = "Model unavailable. Check model setup and server logs."

    def predict(self, image, threshold):
        if settings.demo_mode:
            # Deliberately synthetic: never used as a silent fallback for failed real inference.
            box = {
                "class_name": "person",
                "class_id": 0,
                "confidence": 0.87,
                "x1": image.width * 0.2,
                "y1": image.height * 0.1,
                "x2": image.width * 0.7,
                "y2": image.height * 0.9,
            }
            return ([box] if threshold <= 0.87 else []), 0.0
        if self.model is None:
            raise RuntimeError("model_unavailable")
        with self.lock:
            start = perf_counter()
            results = self.model.predict(
                image, conf=threshold, imgsz=640, device=settings.model_device, verbose=False
            )[0]
            # Includes model preprocess, forward pass and postprocess; excludes lock wait / disk / HTTP.
            latency = (perf_counter() - start) * 1000
            detections = []
            for box in results.boxes:
                coordinates = box.xyxy[0].cpu().tolist()
                class_id = int(box.cls[0])
                detections.append(
                    dict(
                        class_name=results.names[class_id],
                        class_id=class_id,
                        confidence=float(box.conf[0]),
                        **dict(zip(("x1", "y1", "x2", "y2"), coordinates, strict=True)),
                    )
                )
            return detections, latency

    def health(self):
        return {
            "name": "YOLO11n",
            "version": self.version,
            "status": "demo" if settings.demo_mode else "loaded" if self.model is not None else "unavailable",
            "demo_mode": settings.demo_mode,
            "device": settings.model_device,
            "confidence_threshold": settings.confidence_threshold,
            "input_size": 640,
        }


model_service = YOLODetectionService()
