from fastapi.responses import JSONResponse

from app.core.config import settings


class UploadLimitMiddleware:
    """Bound multipart bodies before parsing/spooling, including chunked requests."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] != "http"
            or scope.get("path") != "/api/predictions"
            or scope.get("method") != "POST"
        ):
            return await self.app(scope, receive, send)
        maximum = settings.max_upload_mb * 1024 * 1024 + 64 * 1024
        chunks = []
        size = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > maximum:
                response = JSONResponse(
                    {"detail": f"Please select an image smaller than {settings.max_upload_mb} MB."},
                    status_code=413,
                )
                return await response(scope, receive, send)
            chunks.append(message)
            if not message.get("more_body", False):
                break
        iterator = iter(chunks)

        async def replay():
            try:
                return next(iterator)
            except StopIteration:
                return await receive()

        await self.app(scope, replay, send)
