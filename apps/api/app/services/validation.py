import io
import os
import re
import struct
import subprocess
from typing import Optional, Tuple
from PIL import Image

# Magic byte signatures
MAGIC_JPEG = b"\xFF\xD8\xFF"
MAGIC_PNG = b"\x89PNG\r\n\x1a\n"
MAGIC_RIFF = b"RIFF"
MAGIC_WEBP = b"WEBP"
MAGIC_EBML = b"\x1a\x45\xdf\xa3"  # WebM / MKV

SUPPORTED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
SUPPORTED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}

SUPPORTED_VIDEO_EXTS = {".mp4", ".mov", ".webm"}
SUPPORTED_VIDEO_MIMES = {"video/mp4", "video/quicktime", "video/webm"}


def format_bytes(size_bytes: int) -> str:
    """Format bytes into human-readable string (KB, MB, GB)."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.2f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


def sanitize_filename(filename: str) -> str:
    """Strip path traversal components and harmful characters."""
    base = os.path.basename(filename or "uploaded_media")
    # Remove control characters, quotes, and dangerous shell chars
    sanitized = re.sub(r'[\\/*?:"<>|]', "", base)
    sanitized = sanitized.strip().strip(".")
    return sanitized if sanitized else "uploaded_file"


def validate_image_bytes(file_bytes: bytes, filename: str, max_mb: int) -> Tuple[int, int, str]:
    """
    Validate image file signatures, size, and dimensions.
    Returns (width, height, mime_type).
    Raises ValueError on invalid input.
    """
    size_bytes = len(file_bytes)
    if size_bytes == 0:
        raise ValueError("The uploaded file is empty (0 bytes).")

    if size_bytes > max_mb * 1024 * 1024:
        raise ValueError(
            f"Image size ({format_bytes(size_bytes)}) exceeds the maximum allowed limit of {max_mb} MB."
        )

    ext = os.path.splitext(filename.lower())[1]
    if ext not in SUPPORTED_IMAGE_EXTS:
        raise ValueError(
            f"Unsupported file extension '{ext}'. Supported image formats: JPEG, PNG, WebP."
        )

    # Magic byte signature check
    detected_mime = None
    if file_bytes.startswith(MAGIC_JPEG):
        detected_mime = "image/jpeg"
    elif file_bytes.startswith(MAGIC_PNG):
        detected_mime = "image/png"
    elif len(file_bytes) >= 12 and file_bytes[:4] == MAGIC_RIFF and file_bytes[8:12] == MAGIC_WEBP:
        detected_mime = "image/webp"
    else:
        raise ValueError(
            "File signature mismatch: The uploaded file does not match a valid JPEG, PNG, or WebP image."
        )

    # Validate image decoding and extract dimensions using PIL
    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            img.verify()
        # verify() consumes the stream, reload to get dimensions safely
        with Image.open(io.BytesIO(file_bytes)) as img:
            width, height = img.size
            if width <= 0 or height <= 0:
                raise ValueError("Image dimensions could not be determined.")
            return width, height, detected_mime
    except Exception as e:
        if isinstance(e, ValueError):
            raise
        raise ValueError(f"Corrupted or invalid image data: {str(e)}")


def parse_mp4_duration(file_bytes: bytes) -> Optional[float]:
    """
    Pure Python parser for MP4/MOV container to extract duration from mvhd atom.
    Avoids requiring ffprobe if not installed on the system.
    """
    try:
        offset = 0
        file_len = len(file_bytes)
        moov_offset = -1
        moov_size = -1

        # Scan top-level atoms
        while offset + 8 <= file_len:
            atom_size = struct.unpack(">I", file_bytes[offset:offset + 4])[0]
            atom_type = file_bytes[offset + 4:offset + 8]

            if atom_size == 1:  # 64-bit size
                if offset + 16 > file_len:
                    break
                atom_size = struct.unpack(">Q", file_bytes[offset + 8:offset + 16])[0]
                header_size = 16
            elif atom_size == 0:  # Extends to EOF
                atom_size = file_len - offset
                header_size = 8
            else:
                header_size = 8

            if atom_size < 8:
                break

            if atom_type == b"moov":
                moov_offset = offset + header_size
                moov_size = atom_size - header_size
                break

            offset += atom_size

        if moov_offset != -1:
            # Inside moov, search for mvhd
            curr = moov_offset
            moov_end = min(moov_offset + moov_size, file_len)
            while curr + 8 <= moov_end:
                sub_size = struct.unpack(">I", file_bytes[curr:curr + 4])[0]
                sub_type = file_bytes[curr + 4:curr + 8]

                if sub_size < 8:
                    break

                if sub_type == b"mvhd":
                    mvhd_data = file_bytes[curr + 8:curr + sub_size]
                    if len(mvhd_data) < 20:
                        break
                    version = mvhd_data[0]
                    if version == 0:
                        # 4 bytes create, 4 bytes mod, 4 bytes timescale, 4 bytes duration
                        timescale = struct.unpack(">I", mvhd_data[12:16])[0]
                        duration = struct.unpack(">I", mvhd_data[16:20])[0]
                    elif version == 1:
                        # 8 bytes create, 8 bytes mod, 4 bytes timescale, 8 bytes duration
                        timescale = struct.unpack(">I", mvhd_data[20:24])[0]
                        duration = struct.unpack(">Q", mvhd_data[24:32])[0]
                    else:
                        break

                    if timescale > 0:
                        return duration / timescale
                    break

                curr += sub_size
    except Exception:
        pass
    return None


def get_video_duration_ffprobe(temp_path: str) -> Optional[float]:
    """Attempt to probe video duration with ffprobe if present."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                temp_path,
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            return float(result.stdout.strip())
    except Exception:
        pass
    return None


def validate_video_bytes(
    file_bytes: bytes,
    filename: str,
    max_mb: int,
    max_duration_seconds: int,
    temp_file_path: Optional[str] = None
) -> Tuple[float, str, str]:
    """
    Validate video format, magic bytes, file size, and duration.
    Returns (duration_seconds, mime_type, container_format).
    Raises ValueError on validation failure.
    """
    size_bytes = len(file_bytes)
    if size_bytes == 0:
        raise ValueError("The uploaded video file is empty (0 bytes).")

    if size_bytes > max_mb * 1024 * 1024:
        raise ValueError(
            f"Video size ({format_bytes(size_bytes)}) exceeds the maximum allowed limit of {max_mb} MB."
        )

    ext = os.path.splitext(filename.lower())[1]
    if ext not in SUPPORTED_VIDEO_EXTS:
        raise ValueError(
            f"Unsupported video extension '{ext}'. Supported video formats: MP4, MOV, WebM."
        )

    # Magic byte check
    is_mp4_or_mov = False
    is_webm = False

    if len(file_bytes) >= 12:
        # MP4/MOV typically has 'ftyp' at bytes 4-8 or starts with moov
        atom_type = file_bytes[4:8]
        if atom_type == b"ftyp" or atom_type == b"moov" or atom_type == b"mdat":
            is_mp4_or_mov = True
        elif file_bytes.startswith(MAGIC_EBML):
            is_webm = True

    if not is_mp4_or_mov and not is_webm:
        raise ValueError(
            "File signature mismatch: The uploaded file does not match a valid MP4, MOV, or WebM container."
        )

    container_format = "WebM" if is_webm else ("MOV" if ext == ".mov" else "MP4")
    mime_type = "video/webm" if is_webm else ("video/quicktime" if ext == ".mov" else "video/mp4")

    # Determine duration
    duration: Optional[float] = None

    if is_mp4_or_mov:
        duration = parse_mp4_duration(file_bytes)

    if duration is None and temp_file_path:
        duration = get_video_duration_ffprobe(temp_file_path)

    # If duration could not be determined accurately from headers
    if duration is None:
        # Default fallback estimate or allow if valid container
        duration = 0.0

    if duration > 0 and duration > max_duration_seconds:
        raise ValueError(
            f"Video duration ({duration:.1f}s) exceeds the maximum limit of {max_duration_seconds}s for synchronous analysis. "
            f"Please submit a clip under {max_duration_seconds} seconds or use an asynchronous processing pipeline."
        )

    return duration, mime_type, container_format
