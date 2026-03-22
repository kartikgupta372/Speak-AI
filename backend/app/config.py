from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    ANTHROPIC_API_KEY: str
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    MAX_AUDIO_SIZE_MB: int = 10
    # Set this in production to protect admin endpoints.
    # If left empty, admin routes accept all requests (dev mode).
    ADMIN_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
