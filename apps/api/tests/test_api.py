import io
import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, patch
from PIL import Image

from app.main import app
from app.models import DetectionCategory, DetectionResult, FileInfo, ProvenanceResult


def make_test_jpeg():
    buf = io.BytesIO()
    img = Image.new("RGB", (100, 100), color="red")
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_root_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "MediaCheck AI" in data["app"]
        assert "website_url" in data


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["app"] == "MediaCheck AI"
        assert "provider_configured" in data


@pytest.mark.asyncio
async def test_provider_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health/provider")
        assert response.status_code == 200
        data = response.json()
        assert data["provider"] == "Sightengine"
        assert "max_video_duration_seconds" in data
        assert "is_configured" in data


@pytest.mark.asyncio
async def test_analyze_image_missing_credentials():
    transport = ASGITransport(app=app)
    raw_jpeg = make_test_jpeg()
    with patch("app.services.provider.settings.SIGHTENGINE_API_USER", ""):
        with patch("app.services.provider.settings.SIGHTENGINE_API_SECRET", ""):
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/analyze/image",
                    files={"file": ("test.jpg", raw_jpeg, "image/jpeg")},
                )
                assert response.status_code == 503
                data = response.json()
                assert data["error"] == "PROVIDER_NOT_CONFIGURED"
                assert "Sightengine API credentials are not configured" in data["message"]


@pytest.mark.asyncio
async def test_analyze_image_success_mock():
    transport = ASGITransport(app=app)
    raw_jpeg = make_test_jpeg()

    mock_result = DetectionResult(
        id="mock-123",
        category=DetectionCategory.AI_DETECTED,
        score=0.96,
        score_percentage=96.0,
        confidence_label="High confidence AI signals detected (96.0%)",
        provider="Sightengine",
        method="Sightengine genai model (POST /1.0/check.json)",
        generator_scores={"midjourney": 0.91},
        frames_summary=None,
        average_frame_score=None,
        peak_frame_score=None,
        provenance=ProvenanceResult(
            has_credentials=False,
            format="None",
            status="No Manifest Detected",
            summary="No C2PA manifest found.",
            details={},
        ),
        explanation="The detector identified structural patterns typical of generative AI.",
        limitations=["AI detection is probabilistic."],
        file_info=FileInfo(
            filename="test.jpg",
            file_size_bytes=len(raw_jpeg),
            file_size_formatted="2.0 KB",
            mime_type="image/jpeg",
            media_type="image",
            width=100,
            height=100,
        ),
        analyzed_at="2026-10-20T12:00:00Z",
    )

    with patch("app.services.provider.SightengineProvider.detect_image", new_callable=AsyncMock) as mock_detect:
        mock_detect.return_value = mock_result
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/analyze/image",
                files={"file": ("test.jpg", raw_jpeg, "image/jpeg")},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["category"] == "AI-generated signals detected"
            assert data["score"] == 0.96
            assert data["score_percentage"] == 96.0
            assert data["provider"] == "Sightengine"
            assert data["generator_scores"]["midjourney"] == 0.91
            assert data["file_info"]["filename"] == "test.jpg"


@pytest.mark.asyncio
async def test_analyze_video_invalid_format():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/analyze/video",
            files={"file": ("malicious.exe", b"MZ\x90\x00\x03\x00\x00\x00", "application/octet-stream")},
        )
        assert response.status_code == 400
        data = response.json()
        assert data["error"] == "VALIDATION_ERROR"
