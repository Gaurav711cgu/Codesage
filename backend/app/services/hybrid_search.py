"""
Hybrid Search & Reciprocal Rank Fusion (RRF) Engine.

Dual-retrieval pipeline combining:
1. Dense vector embeddings (semantic similarity via ChromaDB)
2. BM25Okapi sparse keyword retrieval (exact symbol, identifier, token matches)
3. Reciprocal Rank Fusion (RRF with configurable constant k=60) for robust list merging.
"""
from __future__ import annotations

import logging
import math
import re
import threading
from collections import Counter
from typing import Any, Optional

logger = logging.getLogger(__name__)


def tokenize_code(text: str) -> list[str]:
    """
    Code-aware tokenizer for BM25.
    Extracts raw tokens and splits camelCase and snake_case into sub-words
    so both exact identifier matches (e.g. `validate_github_url`) and conceptual
    queries (e.g. `validate github url`) score accurately.
    """
    if not text:
        return []

    raw_tokens = re.findall(r"[A-Za-z0-9_]+", text)
    tokens: list[str] = []

    for token in raw_tokens:
        lower_token = token.lower()
        tokens.append(lower_token)

        # Split snake_case
        if "_" in token:
            parts = [p.lower() for p in token.split("_") if p]
            tokens.extend(parts)

        # Split camelCase / PascalCase
        camel_parts = re.findall(r"[A-Z]?[a-z0-9]+|[A-Z]+(?=[A-Z][a-z0-9]|\b)", token)
        if len(camel_parts) > 1:
            tokens.extend(p.lower() for p in camel_parts if p)

    return tokens


class BM25Okapi:
    """
    In-memory BM25Okapi index tailored for source code retrieval.
    Follows Robertson-Spärck Jones Okapi BM25 formulation with Lucene IDF.
    """

    def __init__(
        self,
        k1: float = 1.5,
        b: float = 0.75,
    ) -> None:
        self.k1 = k1
        self.b = b
        self.doc_ids: list[str] = []
        self.doc_lengths: list[int] = []
        self.avgdl: float = 0.0
        self.corpus_size: int = 0
        self.doc_term_freqs: list[Counter[str]] = []
        self.inverted_index: dict[str, list[int]] = {}  # term -> list of doc indices
        self.idf: dict[str, float] = {}
        self.doc_store: dict[str, dict[str, Any]] = {}

    def index_documents(
        self,
        doc_ids: list[str],
        documents: list[str],
        metadatas: Optional[list[dict[str, Any]]] = None,
    ) -> None:
        """Build the BM25 index from a collection of documents."""
        if not doc_ids or not documents:
            return

        self.doc_ids = list(doc_ids)
        self.corpus_size = len(doc_ids)
        self.doc_lengths = []
        self.doc_term_freqs = []
        self.inverted_index = {}
        self.doc_store = {}

        total_length = 0
        df: Counter[str] = Counter()

        for idx, (doc_id, text) in enumerate(zip(doc_ids, documents)):
            meta = metadatas[idx] if metadatas and idx < len(metadatas) else {}
            self.doc_store[doc_id] = {
                "id": doc_id,
                "document": text,
                "metadata": meta,
            }

            tokens = tokenize_code(text)
            doc_len = len(tokens)
            self.doc_lengths.append(doc_len)
            total_length += doc_len

            term_freq = Counter(tokens)
            self.doc_term_freqs.append(term_freq)

            for term in term_freq.keys():
                df[term] += 1
                if term not in self.inverted_index:
                    self.inverted_index[term] = []
                self.inverted_index[term].append(idx)

        self.avgdl = (total_length / self.corpus_size) if self.corpus_size > 0 else 0.0

        # Calculate Robertson / Lucene IDF
        self.idf = {}
        for term, freq in df.items():
            # Robertson-Spärck Jones IDF with floor protection
            val = math.log(1.0 + (self.corpus_size - freq + 0.5) / (freq + 0.5))
            self.idf[term] = max(val, 0.001)

    def search(self, query: str, top_k: int = 10) -> list[tuple[str, float]]:
        """
        Score documents against query terms using BM25Okapi.
        Returns sorted list of (doc_id, score) pairs in descending order.
        """
        if not self.corpus_size or not query:
            return []

        query_tokens = tokenize_code(query)
        if not query_tokens:
            return []

        candidate_indices: set[int] = set()
        for token in query_tokens:
            if token in self.inverted_index:
                candidate_indices.update(self.inverted_index[token])

        if not candidate_indices:
            return []

        scores: list[tuple[str, float]] = []
        for idx in candidate_indices:
            doc_id = self.doc_ids[idx]
            doc_len = self.doc_lengths[idx]
            term_freqs = self.doc_term_freqs[idx]

            score = 0.0
            denominator_factor = self.k1 * (1.0 - self.b + self.b * (doc_len / (self.avgdl or 1.0)))

            for token in query_tokens:
                if token in term_freqs:
                    freq = term_freqs[token]
                    term_idf = self.idf.get(token, 0.0)
                    numerator = freq * (self.k1 + 1.0)
                    denominator = freq + denominator_factor
                    score += term_idf * (numerator / denominator)

            if score > 0.0:
                scores.append((doc_id, score))

        # Sort descending by score, tie-break by doc_id
        scores.sort(key=lambda item: (-item[1], item[0]))
        return scores[:top_k]

    def get_document(self, doc_id: str) -> Optional[dict[str, Any]]:
        return self.doc_store.get(doc_id)


def reciprocal_rank_fusion(
    rankings_list: list[list[tuple[str, float]]],
    k: int = 60,
    weights: Optional[list[float]] = None,
) -> list[tuple[str, float]]:
    """
    Merge multiple ranked result lists using Reciprocal Rank Fusion (RRF).

    Score formula for document d:
        RRF_score(d) = sum_i [ w_i / (k + rank_i(d)) ]
    where rank_i(d) is 1-indexed rank of document d in ranking list i.

    Parameters:
        rankings_list: List of ranked lists, where each list contains (doc_id, score) pairs.
        k: Smoothing constant (default 60, standard in IR literature).
        weights: Optional relative weighting per ranked list.

    Returns:
        Sorted list of (doc_id, rrf_score) pairs in descending order.
    """
    if not rankings_list:
        return []

    if weights is None:
        weights = [1.0] * len(rankings_list)

    rrf_scores: dict[str, float] = {}

    for ranked_items, weight in zip(rankings_list, weights):
        for rank_idx, (doc_id, _) in enumerate(ranked_items, start=1):
            contribution = weight / (k + rank_idx)
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + contribution

    # Sort descending by RRF score, with deterministic tie-breaking on doc_id
    sorted_fused = sorted(rrf_scores.items(), key=lambda item: (-item[1], item[0]))
    return sorted_fused


class BM25IndexManager:
    """Thread-safe manager maintaining BM25 indices per repository."""

    def __init__(self) -> None:
        self._indices: dict[str, BM25Okapi] = {}
        self._lock = threading.Lock()

    def get_index(self, repo_id: str) -> Optional[BM25Okapi]:
        with self._lock:
            return self._indices.get(repo_id)

    def set_index(self, repo_id: str, index: BM25Okapi) -> None:
        with self._lock:
            self._indices[repo_id] = index

    def build_and_register(
        self,
        repo_id: str,
        doc_ids: list[str],
        documents: list[str],
        metadatas: Optional[list[dict[str, Any]]] = None,
    ) -> BM25Okapi:
        index = BM25Okapi()
        index.index_documents(doc_ids, documents, metadatas)
        with self._lock:
            self._indices[repo_id] = index
        return index

    def invalidate(self, repo_id: str) -> None:
        with self._lock:
            self._indices.pop(repo_id, None)


# Global BM25 index manager instance
bm25_manager = BM25IndexManager()
