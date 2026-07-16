import os
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

    # Gemini
    gemini_api_key: str

    # Database (Supabase PostgreSQL)
    database_url: str

    # ChromaDB
    chromadb_url: str = "http://localhost:8001"
    chroma_auth_token: str = ""

    # Ollama
    ollama_enabled: bool = False
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "codesagez-coder"

    # Upstash Redis (optional, for rate limiting)
    redis_url: str = ""

    # Ingestion
    max_repo_size_kb: int = 100000         # 100 MB
    max_code_input_chars: int = 10000
    tmp_clone_dir: str = "/tmp/codesagez"
    excluded_dirs: list[str] = [
        "tests", "test", "venv", ".venv", "__pycache__",
        "migrations", "node_modules", ".git", "dist", "build",
    ]


settings = Settings()
