from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Required ──────────────────────────────────────────────────────────────
    SUPABASE_URL: str
    SUPABASE_KEY: str
    GROQ_API_KEY: str

    # ── Storage ───────────────────────────────────────────────────────────────
    # Supabase Storage bucket name (created automatically on startup)
    SUPABASE_STORAGE_BUCKET: str = "speak-audio"

    # ── Model / limits ────────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    GROQ_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    MAX_AUDIO_SIZE_MB: int = 10

    # ── Auth ──────────────────────────────────────────────────────────────────
    FRONTEND_API_KEY: str = ""
    ADMIN_KEY: str = ""

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Comma-separated list, e.g. "http://localhost:3000,https://myapp.vercel.app"
    ALLOWED_ORIGINS: str = "*"

    @property
    def origins_list(self) -> list[str]:
        if self.ALLOWED_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
