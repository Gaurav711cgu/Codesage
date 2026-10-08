"""
Resilience Engine: Circuit Breaker with Exponential Backoff and Full Jitter.

Implements Decorator and Runner patterns for robust third-party API integration
(Gemini LLM, Voyage AI, OpenAI, ChromaDB).

Formula for Full Jitter (AWS/Google SRE standard):
    sleep = uniform(0, min(max_delay, base_delay * 2 ** attempt))
"""
from __future__ import annotations

import asyncio
import logging
import random
import time
from typing import Any, Callable, Coroutine, Optional, Tuple, Type

from app.core.circuit_breaker import CircuitBreaker, CircuitBreakerOpenError, CircuitState

logger = logging.getLogger(__name__)


def compute_jittered_delay(
    attempt: int,
    base_delay: float = 0.5,
    max_delay: float = 10.0,
) -> float:
    """
    Compute sleep duration using Full Jitter algorithm:
    sleep = random.uniform(0, min(max_delay, base_delay * (2 ** attempt)))
    """
    exponential_backoff = base_delay * (2 ** attempt)
    ceiling = min(max_delay, exponential_backoff)
    return random.uniform(0.0, ceiling)


def execute_with_resilience_sync(
    func: Callable[..., Any],
    *args: Any,
    breaker: Optional[CircuitBreaker] = None,
    max_retries: int = 3,
    base_delay: float = 0.5,
    max_delay: float = 10.0,
    retryable_exceptions: Tuple[Type[Exception], ...] = (Exception,),
    **kwargs: Any,
) -> Any:
    """
    Execute a synchronous callable with Circuit Breaker and Exponential Backoff + Full Jitter.
    Fails fast if circuit breaker is OPEN.
    Retries transient failures with jittered backoff before recording failure against breaker.
    """
    if breaker is not None and breaker.state == CircuitState.OPEN:
        raise CircuitBreakerOpenError(
            f"CircuitBreaker[{breaker.name}] is OPEN. Downstream call fast-failed without network attempt."
        )

    last_exc: Optional[Exception] = None

    for attempt in range(max_retries):
        try:
            result = func(*args, **kwargs)
            if breaker is not None:
                breaker._on_success()
            return result

        except retryable_exceptions as exc:
            last_exc = exc
            logger.warning(
                "Execution attempt %d/%d failed for %s: %s",
                attempt + 1,
                max_retries,
                getattr(func, "__name__", str(func)),
                exc,
            )

            # Do not sleep on final attempt
            if attempt < max_retries - 1:
                sleep_duration = compute_jittered_delay(attempt, base_delay, max_delay)
                time.sleep(sleep_duration)

    # All retries exhausted — record failure in circuit breaker
    if breaker is not None:
        breaker._on_failure()

    if last_exc:
        raise last_exc
    raise RuntimeError("Execution failed with unspecified error after retries")


async def execute_with_resilience_async(
    coro_func: Callable[..., Coroutine[Any, Any, Any]],
    *args: Any,
    breaker: Optional[CircuitBreaker] = None,
    max_retries: int = 3,
    base_delay: float = 0.5,
    max_delay: float = 10.0,
    retryable_exceptions: Tuple[Type[Exception], ...] = (Exception,),
    **kwargs: Any,
) -> Any:
    """
    Execute an asynchronous coroutine with Circuit Breaker and Exponential Backoff + Full Jitter.
    """
    if breaker is not None and breaker.state == CircuitState.OPEN:
        raise CircuitBreakerOpenError(
            f"CircuitBreaker[{breaker.name}] is OPEN. Downstream async call fast-failed."
        )

    last_exc: Optional[Exception] = None

    for attempt in range(max_retries):
        try:
            result = await coro_func(*args, **kwargs)
            if breaker is not None:
                breaker._on_success()
            return result

        except retryable_exceptions as exc:
            last_exc = exc
            logger.warning(
                "Async attempt %d/%d failed for %s: %s",
                attempt + 1,
                max_retries,
                getattr(coro_func, "__name__", str(coro_func)),
                exc,
            )

            if attempt < max_retries - 1:
                sleep_duration = compute_jittered_delay(attempt, base_delay, max_delay)
                await asyncio.sleep(sleep_duration)

    if breaker is not None:
        breaker._on_failure()

    if last_exc:
        raise last_exc
    raise RuntimeError("Async execution failed with unspecified error after retries")


# Global embedding provider circuit breaker
embedding_breaker = CircuitBreaker(
    name="embedding_api",
    failure_threshold=5,
    recovery_timeout=30.0,
)
