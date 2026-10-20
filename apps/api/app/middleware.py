import contextlib
import logging
import os
import tempfile
import time
from collections import defaultdict
from typing import AsyncGenerator, Tuple
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import settings

logger = logging.getLogger("mediacheck.api")


class RateLimiter:
    """Sliding-window in-memory rate limiter per client IP."""

    def __init__(self, limit_per_minute: int = 60):
        self.limit = limit_per_minute
        self.requests = defaultdict(list)

    def is_allowed(self, client_ip: str) -> Tuple[bool, int]:
        now = time.time()
        window_start = now - 60.0

        # Purge timestamps older than 60s
        self.requests[client_ip] = [ts for ts in self.requests[client_ip] if ts > window_start]

        if len(self.requests[client_ip]) >= self.limit:
            retry_after = int(60.0 - (now - self.requests[client_ip][0]))
            return False, max(retry_after, 1)

        self.requests[client_ip].append(now)
        return True, 0


rate_limiter = RateLimiter(settings.RATE_LIMIT_PER_MINUTE)


class SecurityHeadersAndRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Rate limit check on analysis endpoints
        if request.url.path.startswith("/api/analyze/"):
            client_ip = request.client.host if request.client else "unknown"
            allowed, retry_after = rate_limiter.is_allowed(client_ip)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "RATE_LIMIT_EXCEEDED",
                        "message": f"Rate limit exceeded ({settings.RATE_LIMIT_PER_MINUTE} req/min). Please try again in {retry_after}s.",
                    },
                    headers={"Retry-After": str(retry_after)},
                )

        response: Response = await call_next(request)

        # Standard secure headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        return response


@contextlib.asynccontextmanager
async def secure_temp_file(suffix: str = "") -> AsyncGenerator[str, None]:
    """
    Context manager that creates a secure temporary file on disk,
    yields the path, and guarantees removal in finally block.
    """
    fd, temp_path = tempfile.mkstemp(suffix=suffix, prefix="mediacheck_")
    os.close(fd)
    try:
        yield temp_path
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as e:
                logger.warning("Could not delete temporary file %s: %s", temp_path, e)
