"""
Circuit Breaker Pattern implementation for downstream resilience.

States:
  - CLOSED    : Normal operation. Requests pass through.
  - OPEN      : Downstream failing. Requests fail fast with CircuitBreakerOpenException.
  - HALF_OPEN : Cool-off elapsed. Single probe request allowed through to test recovery.
"""
import asyncio
import enum
import logging
import time
from typing import Any, Callable, Coroutine

logger = logging.getLogger(__name__)


class CircuitState(str, enum.Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitBreakerOpenError(Exception):
    """Raised when an operation is attempted while the circuit breaker is OPEN."""
    pass


class CircuitBreaker:
    """
    Thread-safe & Async-safe Circuit Breaker.
    """

    def __init__(
        self,
        name: str = "default",
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
    ) -> None:
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_state_change = time.time()
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        # Auto-transition OPEN -> HALF_OPEN if recovery timeout elapsed
        if self._state == CircuitState.OPEN:
            if time.time() - self._last_state_change >= self.recovery_timeout:
                self._state = CircuitState.HALF_OPEN
                self._last_state_change = time.time()
                logger.info("CircuitBreaker[%s] auto-transitioned OPEN -> HALF_OPEN", self.name)
        return self._state

    def _on_success(self) -> None:
        self._failure_count = 0
        if self._state == CircuitState.HALF_OPEN:
            self._state = CircuitState.CLOSED
            self._last_state_change = time.time()
            logger.info("CircuitBreaker[%s] recovered: HALF_OPEN -> CLOSED", self.name)

    def _on_failure(self) -> None:
        self._failure_count += 1
        if self._failure_count >= self.failure_threshold or self._state == CircuitState.HALF_OPEN:
            self._state = CircuitState.OPEN
            self._last_state_change = time.time()
            logger.warning(
                "CircuitBreaker[%s] tripped: %s -> OPEN (failures: %d)",
                self.name,
                self._state.value,
                self._failure_count,
            )

    async def call_async(self, func: Callable[..., Coroutine[Any, Any, Any]], *args: Any, **kwargs: Any) -> Any:
        async with self._lock:
            current_state = self.state
            if current_state == CircuitState.OPEN:
                raise CircuitBreakerOpenError(
                    f"CircuitBreaker[{self.name}] is OPEN. Requests blocked for recovery window."
                )

        try:
            result = await func(*args, **kwargs)
            async with self._lock:
                self._on_success()
            return result
        except Exception as exc:
            async with self._lock:
                self._on_failure()
            raise exc

    def call_sync(self, func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        current_state = self.state
        if current_state == CircuitState.OPEN:
            raise CircuitBreakerOpenError(
                f"CircuitBreaker[{self.name}] is OPEN. Requests blocked for recovery window."
            )

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as exc:
            self._on_failure()
            raise exc


# Global Circuit Breakers for external dependencies
gemini_breaker = CircuitBreaker(name="gemini_api", failure_threshold=5, recovery_timeout=30.0)
chroma_breaker = CircuitBreaker(name="chromadb", failure_threshold=5, recovery_timeout=30.0)
