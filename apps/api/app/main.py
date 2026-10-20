import logging
import os
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.middleware import (
    SecurityHeadersAndRateLimitMiddleware,
    secure_temp_file,
)
from app.models import (
    DetectionResult,
    FileInfo,
    HealthResponse,
    ProviderStatusResponse,
)
from app.services.provenance import extract_provenance
from app.services.provider import get_detection_provider
from app.services.validation import (
    format_bytes,
    sanitize_filename,
    validate_image_bytes,
    validate_video_bytes,
)

# Configure logging to never leak binary content or credentials
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("mediacheck.api")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API for MediaCheck AI — Real-time AI image and video detection powered by Sightengine.",
)

# Setup CORS for web app and Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(http://localhost:\d+|http://127\.0\.0\.1:\d+|chrome-extension://.*)$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.add_middleware(SecurityHeadersAndRateLimitMiddleware)


@app.get("/")
async def root():
    """Root welcoming endpoint with helpful pointers."""
    return {
        "app": "MediaCheck AI Backend API",
        "version": settings.APP_VERSION,
        "message": "Welcome to MediaCheck AI API! The website interface runs at http://localhost:3000",
        "website_url": "http://localhost:3000",
        "api_docs": "http://localhost:8000/docs",
        "health_check": "/api/health",
        "provider_status": "/api/health/provider",
    }


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Application readiness and general health check."""
    provider = get_detection_provider()
    return HealthResponse(
        status="ok",
        app=settings.APP_NAME,
        version=settings.APP_VERSION,
        provider_configured=provider.is_configured(),
    )


@app.get("/api/health/provider", response_model=ProviderStatusResponse)
async def provider_health():
    """Report provider configuration and operational limits without exposing credentials."""
    provider = get_detection_provider()
    is_conf = provider.is_configured()
    message = (
        "Sightengine AI detection is configured and ready."
        if is_conf
        else (
            "Sightengine credentials are not configured. Set SIGHTENGINE_API_USER and "
            "SIGHTENGINE_API_SECRET in the backend environment."
        )
    )
    return ProviderStatusResponse(
        provider=provider.name,
        is_configured=is_conf,
        image_endpoint=settings.SIGHTENGINE_IMAGE_ENDPOINT,
        video_sync_endpoint=settings.SIGHTENGINE_VIDEO_SYNC_ENDPOINT,
        max_video_duration_seconds=settings.MAX_VIDEO_DURATION_SECONDS,
        max_image_size_mb=settings.MAX_IMAGE_SIZE_MB,
        max_video_size_mb=settings.MAX_VIDEO_SIZE_MB,
        message=message,
    )


@app.post("/api/analyze/image", response_model=DetectionResult)
async def analyze_image(file: UploadFile = File(...)):
    """
    Validate an uploaded image (signature, MIME, dimensions) and scan for AI-generation signals.
    Inspects Content Credentials/C2PA metadata if present.
    Deletes temporary data immediately upon completion.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail={"error": "INVALID_FILE", "message": "No file uploaded."})

    safe_name = sanitize_filename(file.filename)
    logger.info("Received image analysis request for file: %s", safe_name)

    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail={"error": "READ_ERROR", "message": f"Failed reading uploaded image data: {str(e)}"},
        )
    finally:
        await file.close()

    # Validate image bytes, size, and extract dimensions
    try:
        width, height, detected_mime = validate_image_bytes(
            file_bytes=file_bytes,
            filename=safe_name,
            max_mb=settings.MAX_IMAGE_SIZE_MB,
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=400,
            detail={"error": "VALIDATION_ERROR", "message": str(ve)},
        )

    file_info = FileInfo(
        filename=safe_name,
        file_size_bytes=len(file_bytes),
        file_size_formatted=format_bytes(len(file_bytes)),
        mime_type=detected_mime,
        media_type="image",
        width=width,
        height=height,
    )

    # Optional media provenance / C2PA check
    provenance = extract_provenance(file_bytes, detected_mime)

    # Query detection provider
    provider = get_detection_provider()
    result = await provider.detect_image(
        file_bytes=file_bytes,
        filename=safe_name,
        file_info=file_info,
        provenance=provenance,
    )
    return result


@app.post("/api/analyze/video", response_model=DetectionResult)
async def analyze_video(file: UploadFile = File(...)):
    """
    Validate an uploaded video (container format, magic bytes, duration) and scan for AI signals.
    Supports MP4, MOV, WebM with duration under configured threshold (default < 60s).
    Guarantees temporary file removal on error or success.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail={"error": "INVALID_FILE", "message": "No video uploaded."})

    safe_name = sanitize_filename(file.filename)
    logger.info("Received video analysis request for file: %s", safe_name)

    ext = os.path.splitext(safe_name.lower())[1] or ".mp4"

    # Use secure temporary file context manager
    async with secure_temp_file(suffix=ext) as temp_path:
        try:
            # Stream upload into temporary file
            with open(temp_path, "wb") as f_out:
                while chunk := await file.read(1024 * 1024):  # 1MB chunks
                    f_out.write(chunk)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail={"error": "UPLOAD_ERROR", "message": f"Failed streaming video to disk: {str(e)}"},
            )
        finally:
            await file.close()

        with open(temp_path, "rb") as f_in:
            file_bytes = f_in.read()

        # Validate video format, size, duration
        try:
            duration, mime_type, container = validate_video_bytes(
                file_bytes=file_bytes,
                filename=safe_name,
                max_mb=settings.MAX_VIDEO_SIZE_MB,
                max_duration_seconds=settings.MAX_VIDEO_DURATION_SECONDS,
                temp_file_path=temp_path,
            )
        except ValueError as ve:
            raise HTTPException(
                status_code=400,
                detail={"error": "VALIDATION_ERROR", "message": str(ve)},
            )

        file_info = FileInfo(
            filename=safe_name,
            file_size_bytes=len(file_bytes),
            file_size_formatted=format_bytes(len(file_bytes)),
            mime_type=mime_type,
            media_type="video",
            duration_seconds=round(duration, 2) if duration > 0 else None,
            container_format=container,
        )

        provider = get_detection_provider()
        result = await provider.detect_video(
            file_bytes=file_bytes,
            filename=safe_name,
            file_info=file_info,
        )
        return result


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    """Normalize HTTPException responses into JSON."""
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"error": "HTTP_ERROR", "message": exc.detail})
