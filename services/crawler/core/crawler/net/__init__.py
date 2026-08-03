"""네트워크 계층 공개 경로.

    from crawler.net import PreflightGate, RobotsEvaluator, RateLimiter, RequestLog
    from crawler.net import UrllibTransport, RecordingTransport
"""

from __future__ import annotations

from .preflight import PreflightGate, PreflightResult
from .ratelimit import RateLimiter, RateLimiterRegistry, RequestLog, host_of
from .robots import ROBOTS_TTL_SEC, RobotsEvaluator, RobotsVerdict, robots_url_for
from .transport import (
    DEFAULT_TIMEOUT_SEC,
    MAX_BODY_BYTES,
    RecordingTransport,
    Transport,
    UrllibTransport,
)

__all__ = [
    "DEFAULT_TIMEOUT_SEC",
    "MAX_BODY_BYTES",
    "ROBOTS_TTL_SEC",
    "PreflightGate",
    "PreflightResult",
    "RateLimiter",
    "RateLimiterRegistry",
    "RecordingTransport",
    "RequestLog",
    "RobotsEvaluator",
    "RobotsVerdict",
    "Transport",
    "UrllibTransport",
    "host_of",
    "robots_url_for",
]
