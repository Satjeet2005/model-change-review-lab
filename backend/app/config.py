from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = "postgresql+psycopg://mcrl:mcrl_dev_password@localhost:5432/mcrl"
    TEST_DATABASE_URL: str = "postgresql+psycopg://mcrl:mcrl_dev_password@localhost:5432/mcrl_test"
    CORS_ORIGINS: str = (
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
    )
    SESSION_TTL_DAYS: int = 30
    ENVIRONMENT: str = "development"

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip().rstrip("/") for origin in self.CORS_ORIGINS.split(",") if origin.strip()
        ]

    @property
    def seed_file_path(self) -> Path:
        # Search relative to backend directory or root
        candidates = [
            Path(__file__).resolve().parent.parent.parent / "shared" / "seed-assumptions.json",
            Path.cwd() / "shared" / "seed-assumptions.json",
            Path.cwd().parent / "shared" / "seed-assumptions.json",
            Path("/app/shared/seed-assumptions.json"),
            Path("/shared/seed-assumptions.json"),
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate
        return candidates[0]


settings = Settings()
