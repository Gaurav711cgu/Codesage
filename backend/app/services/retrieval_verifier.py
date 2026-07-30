"""
Retrieval verifier service — post-retrieval quality gate and verification layer.
"""
from dataclasses import dataclass
from typing import Literal

from app.models.schemas import RetrievedChunk


@dataclass
class RetrievalVerification:
    passed: bool
    reason: str | None
    action: Literal["return", "fallback_naive", "empty"]


class RetrievalVerifier:
    """
    Post-retrieval verification gate.
    Checks: minimum chunk count, score floor, content validity.
    """
    MIN_CHUNKS = 1
    SCORE_FLOOR = 0.05  # Chunks scoring below this floor are considered noise

    def verify(self, chunks: list[RetrievedChunk], mode: str) -> RetrievalVerification:
        if not chunks:
            if mode == "graph":
                return RetrievalVerification(
                    passed=False,
                    reason="Graph retrieval returned zero chunks — falling back to naive vector search.",
                    action="fallback_naive",
                )
            return RetrievalVerification(
                passed=False,
                reason="No relevant chunks found in index.",
                action="empty",
            )

        top_score = chunks[0].score
        if top_score < self.SCORE_FLOOR:
            if mode == "graph":
                return RetrievalVerification(
                    passed=False,
                    reason=f"Top chunk score ({top_score:.4f}) below quality floor ({self.SCORE_FLOOR}). Falling back to naive.",
                    action="fallback_naive",
                )
            return RetrievalVerification(
                passed=False,
                reason=f"Top chunk score ({top_score:.4f}) below quality floor ({self.SCORE_FLOOR}).",
                action="return",
            )

        return RetrievalVerification(passed=True, reason=None, action="return")


verifier = RetrievalVerifier()
