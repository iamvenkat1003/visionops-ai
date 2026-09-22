from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.auth.security import CurrentUser
from app.core.config import settings
from app.services.samples import sample_manifest

router = APIRouter(prefix="/api/samples", tags=["Licensed samples"])


@router.get("")
def samples(user: CurrentUser):
    return [
        {
            "id": s["id"],
            "title": s["title"],
            "url": f"/api/samples/{s['id']}/image",
            "credit": s["credit"],
            "license": s["license"],
            "source": s["source"],
            "license_url": s["license_url"],
        }
        for s in sample_manifest()
        if (settings.data_dir / "samples" / f"{s['id']}.jpg").is_file()
    ]


@router.get("/{sample_id}/image")
def sample_image(sample_id: str, user: CurrentUser):
    if not any(s["id"] == sample_id for s in sample_manifest()):
        raise HTTPException(404, "Sample image unavailable.")
    path = settings.data_dir / "samples" / f"{sample_id}.jpg"
    if not path.is_file():
        raise HTTPException(404, "Sample image unavailable.")
    return FileResponse(path, media_type="image/jpeg")
