"""Explicit download step; application startup itself never requires internet."""

import shutil

from app.core.config import settings


def main():
    settings.prepare()
    from ultralytics import YOLO

    settings.model_path.parent.mkdir(parents=True, exist_ok=True)
    if settings.model_path.exists():
        print(f"Model already available: {settings.model_path}")
        return
    model = YOLO("yolo11n.pt")
    source = model.ckpt_path
    shutil.move(str(source), str(settings.model_path))
    print(f"Model ready: {settings.model_path}")


if __name__ == "__main__":
    main()
