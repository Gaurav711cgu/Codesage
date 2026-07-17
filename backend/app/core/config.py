from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "CodeSageZ"
    version: str = "2.0.0"
    environment: str = "development"
    frontend_url: str = "http://localhost:3000"

    # Gemini & GitHub
    gemini_api_key: str = ""
    github_token: str = ""

    # Database. Production must override this with PostgreSQL/Supabase.
    database_url: str = "sqlite+aiosqlite:///./app.db"

    @property
    def async_database_url(self) -> str:
        if self.database_url.startswith("postgres://"):
            return self.database_url.replace("postgres://", "postgresql+asyncpg://", 1)
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return self.database_url

    # ChromaDB
    chromadb_url: str = ""
    chroma_persist_directory: str = "./.chroma"
    chroma_auth_token: str = ""

    # Ollama
    ollama_enabled: bool = False
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "codesagez-coder"

    # Upstash Redis (optional, for rate limiting)
    redis_url: str = ""

    # Ingestion
    max_repo_size_kb: int = 204800         # 200 MB
    max_code_input_chars: int = 10000
    tmp_clone_dir: str = "/tmp/codesagez"
    excluded_dirs: list[str] = [
        "tests", "test", "venv", ".venv", "__pycache__",
        "migrations", "node_modules", ".git", "dist", "build",
    ]

    def validate_production_config(self) -> None:
        if self.environment.lower() != "production":
            return
        missing: list[str] = []
        if self.async_database_url.startswith("sqlite"):
            missing.append("DATABASE_URL (PostgreSQL)")
        if not self.chromadb_url:
            missing.append("CHROMADB_URL (persistent Chroma server)")
        if missing:
            raise RuntimeError("Production configuration requires " + " and ".join(missing))


settings = Settings()
