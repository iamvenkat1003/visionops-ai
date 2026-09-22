import secrets
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./data/visionops.db"
    data_dir: Path = Path("data")
    jwt_secret: str = ""
    jwt_expiry_minutes: int = 480
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    demo_mode: bool = False
    seed_demo_users: bool = True
    demo_employee_password: str = "EmployeeDemo!2026"
    demo_admin_password: str = "AdminDemo!2026"
    model_path: Path = Path("data/models/yolo11n.pt")
    model_device: str = "cpu"
    confidence_threshold: float = 0.25
    max_upload_mb: int = 10
    metrics_token: str = ""

    def prepare(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        if not self.jwt_secret:
            secret_file = self.data_dir / ".jwt-secret"
            if not secret_file.exists():
                try:
                    with secret_file.open("x") as handle:
                        handle.write(secrets.token_urlsafe(48))
                    secret_file.chmod(0o600)
                except FileExistsError:
                    pass
            self.jwt_secret = secret_file.read_text().strip()


settings = Settings()
