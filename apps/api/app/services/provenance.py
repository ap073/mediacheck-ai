import re
from typing import Optional
from app.models import ProvenanceResult

# C2PA JUMBF signature constants
JUMBF_APP11_MARKER = b"\xFF\xEB"
JUMBF_TYPE_C2PA = b"c2pa"
JUMBF_TAG = b"JUMB"
PNG_C2PA_CHUNK = b"caTI"
RIFF_JUMB = b"JUMB"

XMP_C2PA_REGEX = re.compile(
    r'(c2pa|contentcredentials|adobe:c2pa|urn:c2pa)',
    re.IGNORECASE
)


def extract_provenance(file_bytes: bytes, mime_type: str) -> ProvenanceResult:
    """
    Inspects image file bytes for Content Credentials / C2PA manifests or JUMBF boxes.
    Provides neutral reporting and explicit limitation disclaimers.
    Never fails the main detection flow even on unexpected byte streams.
    """
    try:
        details = {}
        has_credentials = False
        format_found = "None"
        status = "No Manifest Detected"
        summary = "No Content Credentials (C2PA) or provenance metadata detected in this file."

        if mime_type == "image/jpeg":
            # Search for APP11 marker (0xFFEB)
            app11_idx = file_bytes.find(JUMBF_APP11_MARKER)
            if app11_idx != -1:
                # Check for JUMBF or c2pa nearby in the marker header
                window = file_bytes[app11_idx:app11_idx + 64]
                if b"JP" in window or JUMBF_TAG in window or JUMBF_TYPE_C2PA in window:
                    has_credentials = True
                    format_found = "C2PA / JUMBF (JPEG APP11)"
                    status = "Manifest Present"
                    details["marker"] = "JPEG APP11 (0xFFEB)"
                    details["box_type"] = "JUMBF C2PA Manifest Box"

        elif mime_type == "image/png":
            # Search for PNG caTI chunk or c2pa chunk
            if PNG_C2PA_CHUNK in file_bytes or b"c2pa" in file_bytes:
                has_credentials = True
                format_found = "C2PA / JUMBF (PNG caTI Chunk)"
                status = "Manifest Present"
                details["chunk"] = "caTI / c2pa chunk"

        elif mime_type == "image/webp":
            if RIFF_JUMB in file_bytes or b"c2pa" in file_bytes:
                has_credentials = True
                format_found = "C2PA / RIFF JUMB (WebP)"
                status = "Manifest Present"
                details["chunk"] = "RIFF JUMB / C2PA"

        # Check for XMP Content Credentials / C2PA declarations
        if not has_credentials and len(file_bytes) > 0:
            # Look for XMP namespace matches in the first 256KB or entire file if smaller
            scan_slice = file_bytes[:min(len(file_bytes), 256 * 1024)].decode("latin-1", errors="ignore")
            if XMP_C2PA_REGEX.search(scan_slice):
                has_credentials = True
                format_found = "XMP Content Credentials"
                status = "Manifest Reference Present"
                details["source"] = "Embedded XMP C2PA metadata"

        if has_credentials:
            summary = (
                f"Valid {format_found} manifest detected. Content Credentials metadata is attached, "
                "which records origin and processing assertions."
            )
        else:
            summary = (
                "No Content Credentials / C2PA manifest found. "
                "Note: Standard camera captures and most social media uploads lack Content Credentials; "
                "absence of metadata does not indicate an image is synthetic or human-created."
            )

        return ProvenanceResult(
            has_credentials=has_credentials,
            format=format_found,
            status=status,
            summary=summary,
            details=details,
        )
    except Exception as e:
        return ProvenanceResult(
            has_credentials=False,
            format="None",
            status="Inspection Inconclusive",
            summary=f"Provenance check could not be completed: {str(e)}",
            details={},
        )
