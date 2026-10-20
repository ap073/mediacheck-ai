import io
import pytest
from PIL import Image

from app.services.validation import (
    format_bytes,
    sanitize_filename,
    validate_image_bytes,
    validate_video_bytes,
)
from app.services.provenance import extract_provenance


def make_test_image_bytes(fmt="JPEG", size=(100, 100), color="blue") -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=fmt)
    return buf.getvalue()


def test_sanitize_filename():
    assert sanitize_filename("../../etc/passwd.jpg") == "passwd.jpg"
    assert sanitize_filename("..\\..\\windows\\system32.png") == "system32.png"
    assert sanitize_filename('photo"<>|:?.png') == "photo.png"
    assert sanitize_filename("") == "uploaded_media"


def test_format_bytes():
    assert format_bytes(500) == "500 B"
    assert format_bytes(2048) == "2.0 KB"
    assert format_bytes(5 * 1024 * 1024) == "5.00 MB"


def test_validate_valid_jpeg():
    raw = make_test_image_bytes("JPEG", (250, 180))
    width, height, mime = validate_image_bytes(raw, "photo.jpg", max_mb=10)
    assert width == 250
    assert height == 180
    assert mime == "image/jpeg"


def test_validate_valid_png():
    raw = make_test_image_bytes("PNG", (320, 240))
    width, height, mime = validate_image_bytes(raw, "sample.png", max_mb=10)
    assert width == 320
    assert height == 240
    assert mime == "image/png"


def test_validate_invalid_extension():
    raw = make_test_image_bytes("PNG")
    with pytest.raises(ValueError, match="Unsupported file extension"):
        validate_image_bytes(raw, "sample.exe", max_mb=10)


def test_validate_signature_mismatch():
    fake_png = b"THIS IS NOT A REAL IMAGE HEADER"
    with pytest.raises(ValueError, match="File signature mismatch"):
        validate_image_bytes(fake_png, "photo.jpg", max_mb=10)


def test_validate_oversized_image():
    raw = make_test_image_bytes("JPEG")
    with pytest.raises(ValueError, match="exceeds the maximum allowed limit"):
        validate_image_bytes(raw, "huge.jpg", max_mb=0)  # 0 MB limit


def test_validate_empty_image():
    with pytest.raises(ValueError, match="file is empty"):
        validate_image_bytes(b"", "empty.png", max_mb=10)


def test_validate_video_container():
    # Valid MP4 dummy box with ftyp
    mp4_bytes = b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41" + b"\x00" * 100
    duration, mime, container = validate_video_bytes(mp4_bytes, "test.mp4", max_mb=50, max_duration_seconds=60)
    assert mime == "video/mp4"
    assert container == "MP4"


def test_validate_video_invalid_magic():
    bad_bytes = b"NOT A VIDEO HEADER CONTENT DUMMY"
    with pytest.raises(ValueError, match="File signature mismatch"):
        validate_video_bytes(bad_bytes, "fake.mp4", max_mb=50, max_duration_seconds=60)


def test_provenance_extraction_default():
    raw = make_test_image_bytes("PNG")
    prov = extract_provenance(raw, "image/png")
    assert prov.has_credentials is False
    assert prov.status == "No Manifest Detected"
    assert "Missing metadata does not prove" in prov.disclaimer
