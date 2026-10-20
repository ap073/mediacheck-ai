import abc
import datetime
import uuid
from typing import Any, Dict, List, Optional, Tuple
import httpx
from fastapi import HTTPException

from app.config import settings
from app.models import (
    DetectionCategory,
    DetectionResult,
    FileInfo,
    ProvenanceResult,
    VideoFrameScore,
)


class BaseDetectionProvider(abc.ABC):
    """Abstract interface for AI detection providers."""

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """Provider name."""
        pass

    @abc.abstractmethod
    def is_configured(self) -> bool:
        """Whether the provider has necessary API credentials configured."""
        pass

    @abc.abstractmethod
    async def detect_image(
        self,
        file_bytes: bytes,
        filename: str,
        file_info: FileInfo,
        provenance: Optional[ProvenanceResult] = None,
    ) -> DetectionResult:
        """Analyze an image and return standardized DetectionResult."""
        pass

    @abc.abstractmethod
    async def detect_video(
        self,
        file_bytes: bytes,
        filename: str,
        file_info: FileInfo,
    ) -> DetectionResult:
        """Analyze a video and return standardized DetectionResult."""
        pass


class SightengineProvider(BaseDetectionProvider):
    """
    Sightengine AI media detection integration.
    Uses official Sightengine genai endpoints:
    - Image: POST /1.0/check.json (models=genai)
    - Video (sync): POST /1.0/video/check-sync.json (models=genai)
    """

    @property
    def name(self) -> str:
        return "Sightengine"

    def is_configured(self) -> bool:
        user = (settings.SIGHTENGINE_API_USER or "").strip()
        secret = (settings.SIGHTENGINE_API_SECRET or "").strip()
        if not user or not secret:
            return False
        # Catch common placeholder text
        lower_user = user.lower()
        if "your_" in lower_user or "placeholder" in lower_user or "here" in lower_user:
            return False
        return True

    def _get_credentials_error(self) -> HTTPException:
        return HTTPException(
            status_code=503,
            detail={
                "error": "PROVIDER_NOT_CONFIGURED",
                "message": (
                    "Sightengine API credentials are not configured on the backend. "
                    "Please obtain an API User and API Secret from https://sightengine.com "
                    "and set SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET in your backend .env file or environment."
                ),
            },
        )

    def _categorize_score(self, score: Optional[float]) -> Tuple[DetectionCategory, str, str]:
        """
        Calibrate Sightengine raw score into category and neutral explanation.
        Category rules:
        - score >= 0.65: AI-generated signals detected
        - score <= 0.35: No AI-generated signals detected
        - In between or missing: Inconclusive
        """
        if score is None:
            return (
                DetectionCategory.INCONCLUSIVE,
                "Score unavailable",
                "The detection engine was unable to extract an AI generation confidence score from the provided media.",
            )

        pct = score * 100.0

        if score >= 0.65:
            return (
                DetectionCategory.AI_DETECTED,
                f"High confidence AI signals detected ({pct:.1f}%)",
                (
                    f"The detector identified structural, frequency, or textural patterns typical of "
                    f"generative AI models with an API score of {score:.3f} ({pct:.1f}%). "
                    f"Note that this score reflects pattern detection, not mathematical certainty."
                ),
            )
        elif score <= 0.35:
            return (
                DetectionCategory.NO_AI_DETECTED,
                f"No significant AI signals detected ({pct:.1f}%)",
                (
                    f"The detector did not identify sufficient generative AI artifacts (API score {score:.3f}, {pct:.1f}%). "
                    f"Important: Absence of detected AI artifacts does NOT prove human capture or creation, "
                    f"as high-fidelity AI tools or post-processing can evade detection."
                ),
            )
        else:
            return (
                DetectionCategory.INCONCLUSIVE,
                f"Ambiguous or borderline score ({pct:.1f}%)",
                (
                    f"The detector returned an intermediate score of {score:.3f} ({pct:.1f}%). "
                    f"The file contains mixed or faint signals that cannot be reliably classified as either "
                    f"purely AI-generated or camera-original."
                ),
            )

    async def detect_image(
        self,
        file_bytes: bytes,
        filename: str,
        file_info: FileInfo,
        provenance: Optional[ProvenanceResult] = None,
    ) -> DetectionResult:
        if not self.is_configured():
            raise self._get_credentials_error()

        files = {"media": (filename, file_bytes, file_info.mime_type)}
        data = {
            "models": "genai",
            "api_user": settings.SIGHTENGINE_API_USER,
            "api_secret": settings.SIGHTENGINE_API_SECRET,
        }

        try:
            async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    settings.SIGHTENGINE_IMAGE_ENDPOINT,
                    data=data,
                    files=files,
                )
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail={"error": "PROVIDER_TIMEOUT", "message": "Sightengine API request timed out. Please retry."},
            )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail={"error": "PROVIDER_UNREACHABLE", "message": f"Network error contacting Sightengine: {str(exc)}"},
            )

        if response.status_code != 200:
            try:
                err_json = response.json()
                err_msg = err_json.get("error", {}).get("message") or err_json.get("message")
            except Exception:
                err_msg = response.text[:200]

            if response.status_code == 401:
                detail_msg = (
                    "Sightengine authentication failed (HTTP 401: Invalid Credentials). "
                    "Your SIGHTENGINE_API_USER or SIGHTENGINE_API_SECRET is incorrect. "
                    "Please check your API User and API Secret at https://dashboard.sightengine.com/api-credentials "
                    "and update them in apps/api/.env."
                )
            else:
                detail_msg = f"Sightengine API returned HTTP {response.status_code}: {err_msg}"

            raise HTTPException(
                status_code=502,
                detail={
                    "error": "PROVIDER_HTTP_ERROR",
                    "status_code": response.status_code,
                    "message": detail_msg,
                },
            )

        payload = response.json()
        if payload.get("status") == "failure":
            err_msg = payload.get("error", {}).get("message", "Sightengine reported an error")
            raise HTTPException(
                status_code=400,
                detail={"error": "PROVIDER_ERROR", "message": f"Sightengine error: {err_msg}"},
            )

        # Parse Sightengine response format:
        # payload['type']['ai_generated'] or payload.get('type', {}).get('genai')
        type_obj = payload.get("type", {})
        ai_score: Optional[float] = None
        if "ai_generated" in type_obj:
            ai_score = float(type_obj["ai_generated"])
        elif "genai" in type_obj:
            ai_score = float(type_obj["genai"])

        # Extract generator-specific scores if available
        generator_scores: Dict[str, float] = {}
        for key, val in type_obj.items():
            if key not in ("ai_generated", "genai") and isinstance(val, (int, float)):
                generator_scores[key] = float(val)

        if "generators" in type_obj and isinstance(type_obj["generators"], dict):
            for gen_name, gen_val in type_obj["generators"].items():
                if isinstance(gen_val, (int, float)):
                    generator_scores[gen_name] = float(gen_val)

        category, confidence_label, explanation = self._categorize_score(ai_score)

        limitations = [
            "AI detection is probabilistic and cannot guarantee 100% accuracy.",
            "Heavy compression, resizing, filtering, or noise may obscure generative artifacts.",
            "Absence of AI signals never proves authentic human capture.",
        ]

        return DetectionResult(
            id=str(uuid.uuid4()),
            category=category,
            score=ai_score,
            score_percentage=round(ai_score * 100.0, 1) if ai_score is not None else None,
            confidence_label=confidence_label,
            provider="Sightengine",
            method="Sightengine genai model (POST /1.0/check.json)",
            generator_scores=generator_scores,
            frames_summary=None,
            average_frame_score=None,
            peak_frame_score=None,
            provenance=provenance,
            explanation=explanation,
            limitations=limitations,
            file_info=file_info,
            analyzed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        )

    async def detect_video(
        self,
        file_bytes: bytes,
        filename: str,
        file_info: FileInfo,
    ) -> DetectionResult:
        if not self.is_configured():
            raise self._get_credentials_error()

        files = {"media": (filename, file_bytes, file_info.mime_type)}
        data = {
            "models": "genai",
            "api_user": settings.SIGHTENGINE_API_USER,
            "api_secret": settings.SIGHTENGINE_API_SECRET,
        }

        try:
            # Video analysis can take longer
            timeout_seconds = max(settings.REQUEST_TIMEOUT_SECONDS, 90.0)
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.post(
                    settings.SIGHTENGINE_VIDEO_SYNC_ENDPOINT,
                    data=data,
                    files=files,
                )
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail={
                    "error": "PROVIDER_TIMEOUT",
                    "message": "Sightengine synchronous video analysis timed out. The video may be too long or complex.",
                },
            )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail={"error": "PROVIDER_UNREACHABLE", "message": f"Network error contacting Sightengine: {str(exc)}"},
            )

        if response.status_code != 200:
            try:
                err_json = response.json()
                err_msg = err_json.get("error", {}).get("message") or err_json.get("message")
            except Exception:
                err_msg = response.text[:200]

            if response.status_code == 401:
                detail_msg = (
                    "Sightengine authentication failed (HTTP 401: Invalid Credentials). "
                    "Your SIGHTENGINE_API_USER or SIGHTENGINE_API_SECRET is incorrect. "
                    "Please check your credentials at https://dashboard.sightengine.com/api-credentials "
                    "and update them in apps/api/.env."
                )
            else:
                detail_msg = f"Sightengine video API returned HTTP {response.status_code}: {err_msg}"

            raise HTTPException(
                status_code=502,
                detail={
                    "error": "PROVIDER_HTTP_ERROR",
                    "status_code": response.status_code,
                    "message": detail_msg,
                },
            )

        payload = response.json()
        if payload.get("status") == "failure":
            err_msg = payload.get("error", {}).get("message", "Sightengine reported a video analysis error")
            raise HTTPException(
                status_code=400,
                detail={"error": "PROVIDER_ERROR", "message": f"Sightengine video error: {err_msg}"},
            )

        # Parse Sightengine video frames
        # data: { frames: [ { info: { position: 0 }, type: { ai_generated: 0.95 } } ] }
        frames: List[VideoFrameScore] = []
        data_obj = payload.get("data", {})
        raw_frames = data_obj.get("frames", [])

        generator_scores: Dict[str, float] = {}

        if isinstance(raw_frames, list):
            for f in raw_frames:
                pos = float(f.get("info", {}).get("position", 0.0))
                ftype = f.get("type", {})
                fscore = ftype.get("ai_generated")
                if fscore is None:
                    fscore = ftype.get("genai")
                if fscore is not None:
                    frames.append(VideoFrameScore(position_seconds=round(pos, 2), score=round(float(fscore), 4)))

                # Collect any generator scores
                for gk, gv in ftype.items():
                    if gk not in ("ai_generated", "genai") and isinstance(gv, (int, float)):
                        generator_scores[gk] = max(generator_scores.get(gk, 0.0), float(gv))

        # Calculate composite score across video frames
        if frames:
            scores_list = [f.score for f in frames]
            avg_score = sum(scores_list) / len(scores_list)
            peak_score = max(scores_list)
            # Video score: weighted combination giving weight to consistent high detection across frames
            composite_score = round(0.6 * peak_score + 0.4 * avg_score, 4)
        else:
            avg_score = None
            peak_score = None
            composite_score = None

        category, confidence_label, explanation = self._categorize_score(composite_score)

        limitations = [
            "Synchronous video analysis evaluates sampled keyframes across the file duration.",
            "Videos longer than 60 seconds should be clipped or processed through an asynchronous batch workflow.",
            "Video re-encoding, low bitrates, or motion blur can mask subtle deepfake and generative signals.",
            "Absence of AI signals does NOT certify an authentic camera recording.",
        ]

        return DetectionResult(
            id=str(uuid.uuid4()),
            category=category,
            score=composite_score,
            score_percentage=round(composite_score * 100.0, 1) if composite_score is not None else None,
            confidence_label=confidence_label,
            provider="Sightengine",
            method="Sightengine synchronous video model (POST /1.0/video/check-sync.json)",
            generator_scores=generator_scores,
            frames_summary=frames if frames else None,
            average_frame_score=round(avg_score, 4) if avg_score is not None else None,
            peak_frame_score=round(peak_score, 4) if peak_score is not None else None,
            provenance=None,
            explanation=explanation,
            limitations=limitations,
            file_info=file_info,
            analyzed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        )


# Global default provider instance
detection_provider: BaseDetectionProvider = SightengineProvider()


def get_detection_provider() -> BaseDetectionProvider:
    return detection_provider
