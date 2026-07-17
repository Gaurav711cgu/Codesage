FROM python:3.11-slim

# System deps for gitpython and tree-sitter compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Temp directory for repo clones and data directory for ChromaDB
RUN mkdir -p /tmp/codesagez /data/chroma && chmod 777 /data /data/chroma

# A single worker is safe with the local development store. Set WEB_CONCURRENCY
# only when CHROMADB_URL points at a shared persistent Chroma deployment.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860} --workers ${WEB_CONCURRENCY:-1}
