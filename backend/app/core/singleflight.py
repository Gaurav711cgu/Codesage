"""
SingleFlight / Request Coalescing Pattern.

Suppresses redundant, duplicate concurrent async executions for identical keys.
If 50 concurrent requests hit for key 'repo1:query', singleflight executes the underlying
work ONCE and multiplexes/shares the identical result across all 50 waiting coroutines.
"""
import asyncio
import logging
from typing import Any, Callable, Coroutine, Dict

logger = logging.getLogger(__name__)


class _Call:
    def __init__(self) -> None:
        self.future: asyncio.Future[Any] = asyncio.get_event_loop().create_future()
        self.dups: int = 0


class SingleFlightGroup:
    """
    Manages key-indexed async in-flight calls.
    """

    def __init__(self) -> None:
        self._calls: Dict[str, _Call] = {}
        self._lock = asyncio.Lock()

    async def do(self, key: str, fn: Callable[..., Coroutine[Any, Any, Any]], *args: Any, **kwargs: Any) -> Any:
        """
        Execute `fn(*args, **kwargs)` for `key` once, or wait for an already in-flight call to finish.
        """
        async with self._lock:
            if key in self._calls:
                call = self._calls[key]
                call.dups += 1
                logger.debug("SingleFlight coalesced request for key %s (waiting callers: %d)", key[:12], call.dups)
                # Release lock and await existing future
                future = call.future

            else:
                call = _Call()
                self._calls[key] = call
                future = call.future
                # Spawn single execution
                asyncio.create_task(self._exec(key, call, fn, *args, **kwargs))

        return await future

    async def _exec(self, key: str, call: _Call, fn: Callable[..., Coroutine[Any, Any, Any]], *args: Any, **kwargs: Any) -> None:
        try:
            result = await fn(*args, **kwargs)
            call.future.set_result(result)
        except Exception as exc:
            call.future.set_exception(exc)
        finally:
            async with self._lock:
                self._calls.pop(key, None)


# Global singleflight group instance
single_flight = SingleFlightGroup()
