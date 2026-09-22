import json

from app.core.config import settings


def sample_manifest():
    path = settings.data_dir / "samples" / "manifest.json"
    if not path.is_file():
        return []
    return json.loads(path.read_text())
