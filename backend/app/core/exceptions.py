"""Custom application exceptions and unified JSON error formatting.
Ensures standard {"error": {"code": "...", "message": "..."}} structure across all HTTP responses.
"""

from typing import Optional, Dict
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi.errors import RateLimitExceeded

class AppException(Exception):
    """Base application exception holding machine-readable code, user message, and HTTP status."""
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        headers: Optional[Dict[str, str]] = None
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.headers = headers
        super().__init__(message)

async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Serializes AppException into standard error schema."""
    return JSONResponse(
        status_code=exc.status_code,
        headers=exc.headers,
        content={"error": {"code": exc.code, "message": exc.message}}
    )

async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Translates standard HTTP errors into standard error schema."""
    code_map = {
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        429: "TOO_MANY_REQUESTS",
        500: "INTERNAL_SERVER_ERROR",
    }
    error_code = code_map.get(exc.status_code, f"HTTP_{exc.status_code}")
    message = exc.detail if isinstance(exc.detail, str) else "An HTTP error occurred"
    return JSONResponse(
        status_code=exc.status_code,
        headers=exc.headers,
        content={"error": {"code": error_code, "message": message}}
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Translates request validation errors into unified schema without exposing internals."""
    errors = exc.errors()
    first_error = errors[0] if errors else {}
    msg = first_error.get("msg", "Invalid request parameters")
    loc = " -> ".join(str(l) for l in first_error.get("loc", []))
    formatted_msg = f"{loc}: {msg}" if loc else msg
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": {"code": "VALIDATION_ERROR", "message": formatted_msg}}
    )

async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Translates SlowAPI RateLimitExceeded into standard 429 response."""
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many requests. You have exceeded the login rate limit of 5 attempts per minute."
            }
        }
    )

async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catches unexpected exceptions to prevent unformatted 500 HTML responses."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected internal server error occurred."
            }
        }
    )
