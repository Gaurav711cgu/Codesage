import pytest
from unittest.mock import MagicMock
from backend.services.rag import RAGPipeline, DocumentChunk

def test_rag_pipeline_initialization():
    """Verify RAG pipeline initializes with correct default models."""
    pipeline = RAGPipeline()
    assert pipeline is not None
    assert pipeline.embedding_model_name == "sentence-transformers/all-MiniLM-L6-v2"

def test_document_chunking():
    """Test that long documents are correctly chunked into smaller segments."""
    pipeline = RAGPipeline()
    long_text = "word " * 1000
    chunks = pipeline.chunk_document(long_text, chunk_size=200, overlap=50)
    assert len(chunks) > 1
    assert all(len(chunk) <= 250 for chunk in chunks)

def test_embedding_generation():
    """Verify embeddings are generated with correct dimensionality."""
    pipeline = RAGPipeline()
    embedding = pipeline.generate_embedding("def foo(): pass")
    assert len(embedding) == 384

def test_vector_search_mock():
    """Test similarity search with a mocked vector DB."""
    pipeline = RAGPipeline()
    pipeline.vector_db.search = MagicMock(return_value=[
        DocumentChunk(text="def foo(): pass", score=0.92)
    ])
    
    results = pipeline.search_similar("foo function", top_k=1)
    assert len(results) == 1
    assert results[0].score == 0.92

def test_context_prompt_formatting():
    """Test that context is correctly injected into the LLM prompt."""
    pipeline = RAGPipeline()
    context_chunks = [DocumentChunk(text="class User:", score=0.9)]
    prompt = pipeline.format_prompt("How to create a user?", context_chunks)
    assert "class User:" in prompt
    assert "How to create a user?" in prompt
