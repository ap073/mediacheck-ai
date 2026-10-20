import pytest
from unittest.mock import AsyncMock, patch
import httpx
from fastapi import HTTPException

from app.models import DetectionCategory, FileInfo
from app.services.provider import SightengineProvider


def test_categorize_score_high_ai():
    provider = SightengineProvider()
    cat, label, exp = provider._categorize_score(0.95)
    assert cat == DetectionCategory.AI_DETECTED
    assert "95.0%" in label
    assert "structural, frequency, or textural" in exp


def test_categorize_score_low_ai():
    provider = SightengineProvider()
    cat, label, exp = provider._categorize_score(0.05)
    assert cat == DetectionCategory.NO_AI_DETECTED
    assert "5.0%" in label
    assert "does NOT prove human capture" in exp


def test_categorize_score_inconclusive():
    provider = SightengineProvider()
    cat, label, exp = provider._categorize_score(0.50)
    assert cat == DetectionCategory.INCONCLUSIVE
    assert "50.0%" in label


def test_categorize_score_none():
    provider = SightengineProvider()
    cat, label, exp = provider._categorize_score(None)
    assert cat == DetectionCategory.INCONCLUSIVE


@pytest.mark.asyncio
async def test_detect_image_unconfigured():
    provider = SightengineProvider()
    with patch("app.services.provider.settings.SIGHTENGINE_API_USER", ""):
        with patch("app.services.provider.settings.SIGHTENGINE_API_SECRET", ""):
            file_info = FileInfo(
                filename="test.jpg",
                file_size_bytes=1000,
                file_size_formatted="1.0 KB",
                mime_type="image/jpeg",
                media_type="image",
            )
            with pytest.raises(HTTPException) as exc_info:
                await provider.detect_image(b"fake", "test.jpg", file_info)
            assert exc_info.value.status_code == 503
            assert exc_info.value.detail["error"] == "PROVIDER_NOT_CONFIGURED"


@pytest.mark.asyncio
async def test_detect_image_mock_sightengine_success():
    provider = SightengineProvider()
    mock_response_data = {
        "status": "success",
        "request": {"id": "req_123"},
        "type": {
            "ai_generated": 0.88,
            "midjourney": 0.82,
            "dall-e": 0.04,
        },
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_response_data,
        request=httpx.Request("POST", "https://api.sightengine.com/1.0/check.json"),
    )

    with patch("app.services.provider.settings.SIGHTENGINE_API_USER", "valid_user"):
        with patch("app.services.provider.settings.SIGHTENGINE_API_SECRET", "valid_secret"):
            with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
                mock_post.return_value = mock_resp

                file_info = FileInfo(
                    filename="sample.jpg",
                    file_size_bytes=2048,
                    file_size_formatted="2.0 KB",
                    mime_type="image/jpeg",
                    media_type="image",
                    width=400,
                    height=300,
                )

                res = await provider.detect_image(b"bytes", "sample.jpg", file_info)

                assert res.category == DetectionCategory.AI_DETECTED
                assert res.score == 0.88
                assert res.score_percentage == 88.0
                assert res.generator_scores.get("midjourney") == 0.82
                assert res.provider == "Sightengine"


@pytest.mark.asyncio
async def test_detect_video_mock_sightengine_success():
    provider = SightengineProvider()
    mock_response_data = {
        "status": "success",
        "request": {"id": "req_video_123"},
        "data": {
            "frames": [
                {"info": {"position": 0.0}, "type": {"ai_generated": 0.90}},
                {"info": {"position": 1.0}, "type": {"ai_generated": 0.94}},
                {"info": {"position": 2.0}, "type": {"ai_generated": 0.86}},
            ]
        },
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_response_data,
        request=httpx.Request("POST", "https://api.sightengine.com/1.0/video/check-sync.json"),
    )

    with patch("app.services.provider.settings.SIGHTENGINE_API_USER", "valid_user"):
        with patch("app.services.provider.settings.SIGHTENGINE_API_SECRET", "valid_secret"):
            with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
                mock_post.return_value = mock_resp

                file_info = FileInfo(
                    filename="clip.mp4",
                    file_size_bytes=50000,
                    file_size_formatted="50.0 KB",
                    mime_type="video/mp4",
                    media_type="video",
                    duration_seconds=3.0,
                    container_format="MP4",
                )

                res = await provider.detect_video(b"video_bytes", "clip.mp4", file_info)

                assert res.category == DetectionCategory.AI_DETECTED
                assert res.frames_summary is not None
                assert len(res.frames_summary) == 3
                assert res.peak_frame_score == 0.94
                assert res.average_frame_score == 0.90
