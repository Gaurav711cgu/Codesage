"""
Prometheus RED Metrics Exporter (Rate, Errors, Duration).

Exposes production metrics at GET /metrics for Prometheus scraping & Grafana dashboards.
"""
import re
import time
from typing import Callable, Dict
from fastapi import APIRouter, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

metrics_router = APIRouter(tags=["metrics"])


def _normalize_path(path: str) -> str:
    """Replace UUIDs and numeric IDs with placeholders to prevent cardinality explosion."""
    path = re.sub(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "{id}", path)
    path = re.sub(r"/\d+", "/{id}", path)
    return path


# Pure Python Prometheus Metrics Registry
class MetricsRegistry:
    def __init__(self) -> None:
        self.request_counts: Dict[str, int] = {}
        self.cache_hits: int = 0
        self.cache_misses: int = 0
        self.latencies: list[float] = []

    def inc_request(self, method: str, path: str, status: int) -> None:
        key = f'{method}:{_normalize_path(path)}:{status}'
        self.request_counts[key] = self.request_counts.get(key, 0) + 1

    def observe_latency(self, duration_sec: float) -> None:
        self.latencies.append(duration_sec)
        if len(self.latencies) > 10000:
            self.latencies = self.latencies[-5000:]

    def inc_cache_hit(self) -> None:
        self.cache_hits += 1

    def inc_cache_miss(self) -> None:
        self.cache_misses += 1

    def generate_prometheus_text(self) -> str:
        lines = [
            "# HELP codesagez_http_requests_total Total HTTP Requests",
            "# TYPE codesagez_http_requests_total counter",
        ]
        for key, count in self.request_counts.items():
            method, path, status = key.split(":")
            lines.append(
                f'codesagez_http_requests_total{{method="{method}",path="{path}",status="{status}"}} {count}'
            )

        lines.extend([
            "# HELP codesagez_cache_hits_total Total Cache Hits",
            "# TYPE codesagez_cache_hits_total counter",
            f"codesagez_cache_hits_total {self.cache_hits}",
            "# HELP codesagez_cache_misses_total Total Cache Misses",
            "# TYPE codesagez_cache_misses_total counter",
            f"codesagez_cache_misses_total {self.cache_misses}",
        ])

        if self.latencies:
            sorted_lat = sorted(self.latencies)
            n = len(sorted_lat)
            p50 = sorted_lat[int(n * 0.50)]
            p95 = sorted_lat[int(n * 0.95)]
            p99 = sorted_lat[int(n * 0.99)]
            lines.extend([
                "# HELP codesagez_http_request_duration_seconds HTTP Request Latency",
                "# TYPE codesagez_http_request_duration_seconds summary",
                f'codesagez_http_request_duration_seconds{{quantile="0.5"}} {p50:.4f}',
                f'codesagez_http_request_duration_seconds{{quantile="0.95"}} {p95:.4f}',
                f'codesagez_http_request_duration_seconds{{quantile="0.99"}} {p99:.4f}',
            ])

        return "\n".join(lines) + "\n"


metrics_registry = MetricsRegistry()


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> StarletteResponse:
        start_time = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start_time

        # Track RED metrics
        path = request.url.path
        if not path.startswith("/metrics"):
            metrics_registry.inc_request(request.method, path, response.status_code)
            metrics_registry.observe_latency(duration)

        return response


@metrics_router.get("/metrics")
async def get_metrics():
    """Prometheus metrics scraping endpoint."""
    content = metrics_registry.generate_prometheus_text()
    return StarletteResponse(content=content, media_type="text/plain; version=0.0.4")
