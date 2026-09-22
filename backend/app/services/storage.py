import uuid
import warnings
from abc import ABC, abstractmethod
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings

Image.MAX_IMAGE_PIXELS = 20_000_000


class ImageStorage(ABC):
    @abstractmethod
    def save(self, image: Image.Image) -> str: ...

    @abstractmethod
    def resolve(self, key: str) -> Path: ...


class LocalImageStorage(ImageStorage):
    @property
    def root(self):
        return settings.data_dir / "uploads"

    def save(self, image):
        self.root.mkdir(parents=True, exist_ok=True)
        key = f"{uuid.uuid4().hex}.jpg"
        # Re-encode to strip EXIF/GPS and to ensure stored bytes are a decoded image.
        image.save(self.root / key, format="JPEG", quality=92)
        return key

    def resolve(self, key):
        if Path(key).name != key:
            raise HTTPException(404, "Image not found.")
        path = self.root / key
        if not path.is_file():
            raise HTTPException(404, "This image is no longer available.")
        return path


storage = LocalImageStorage()


def validate_image(data: bytes, filename: str, content_type: str):
    if not data:
        raise HTTPException(400, "The uploaded file is empty. Please select an image.")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"Please select an image smaller than {settings.max_upload_mb} MB.")
    if Path(filename).suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"} or content_type not in {
        "image/jpeg",
        "image/png",
        "image/webp",
    }:
        raise HTTPException(415, "Please upload a JPEG, PNG, or WebP image.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if image.format not in {"JPEG", "PNG", "WEBP"}:
                    raise ValueError("Unsupported image encoding")
                image.verify()
            with Image.open(BytesIO(data)) as image:
                image.load()
                return ImageOps.exif_transpose(image).convert("RGB")
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise HTTPException(
            400, "We couldn’t read this image. Use a valid JPEG, PNG, or WebP under 20 megapixels."
        ) from None
