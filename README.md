# MediaCheck AI — AI Image & Video Detector

> **MediaCheck AI** is a full-stack media authentication suite designed to detect signals of AI-generated images and videos. It combines deep-learning visual artifact detection via the official **Sightengine API** (`models=genai`), Content Credentials (**C2PA**) provenance inspection, a modern **Next.js** web application, and a **Chrome Extension (Manifest V3)** with context-menu scanning.

---

## Table of Contents

1. [Features](#features)
2. [Project Architecture](#project-architecture)
3. [Prerequisites](#prerequisites)
4. [Sightengine API Setup](#sightengine-api-setup)
5. [Installation & Setup](#installation--setup)
   - [Windows PowerShell](#windows-powershell)
   - [Linux / macOS](#linux--macos)
6. [Running the Application](#running-the-application)
7. [Building & Installing the Chrome Extension](#building--installing-the-chrome-extension)
8. [Automated Testing](#automated-testing)
9. [Example API Requests](#example-api-requests)
10. [Result Categories & Scientific Interpretation](#result-categories--scientific-interpretation)
11. [Privacy & Security Controls](#privacy--security-controls)
12. [Troubleshooting & Limitations](#troubleshooting--limitations)

---

## Features

- **Multi-Format Support**:
  - **Images**: JPEG, PNG, WebP (magic byte validation, size limits up to 20MB).
  - **Videos**: MP4, MOV, WebM (short-video synchronous analysis up to 60 seconds).
- **Sightengine Official Integration**:
  - Image Endpoint: `POST https://api.sightengine.com/1.0/check.json` (`models=genai`).
  - Video Synchronous Endpoint: `POST https://api.sightengine.com/1.0/video/check-sync.json` (`models=genai`).
  - Generator Model Scores: Midjourney, DALL-E, Stable Diffusion signatures when returned.
  - Sampled keyframe scores and timeline breakdown for videos.
- **Content Credentials / C2PA Provenance**:
  - Inspects JPEG APP11 (`0xFFEB`), PNG `caTI`/`c2pa` chunks, and WebP JUMBF manifests.
  - Reports provenance status independently from AI probability scores.
- **Chrome Extension (Manifest V3)**:
  - Right-click `"Check image with MediaCheck AI"` context menu action.
  - Popup interface with direct file uploads and compact results dashboard.
  - Configurable backend API URL with secure host permissions.
- **Privacy First**:
  - Zero server persistence: Uploaded media is analyzed in memory or temporary files and deleted immediately in `finally` blocks.
  - Path traversal and file signature sanitization.
  - In-memory sliding window rate limiting.

---

## Project Architecture

```
mediacheck-ai/
├── apps/
│   ├── api/                     # Python FastAPI Backend
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── config.py        # Pydantic settings & environment configuration
│   │   │   ├── main.py          # FastAPI application, routes, and CORS
│   │   │   ├── middleware.py    # Rate limiting & secure temp-file management
│   │   │   ├── models.py        # Pydantic schemas and enum categories
│   │   │   └── services/
│   │   │       ├── provider.py  # Sightengine integration & provider interface
│   │   │       ├── provenance.py# C2PA / JUMBF / XMP metadata parser
│   │   │       └── validation.py# Magic bytes, MP4 atom parser & FFprobe
│   │   ├── tests/
│   │   │   ├── test_api.py      # Route tests & HTTP status tests
│   │   │   ├── test_provider.py # Sightengine mock payload & scoring tests
│   │   │   └── test_validation.py# File signature, size & duration tests
│   │   ├── requirements.txt
│   │   └── .env.example
│   │
│   ├── web/                     # Next.js 14 Frontend
│   │   ├── src/
│   │   │   ├── app/             # App Router layout, globals.css, and home page
│   │   │   ├── components/      # Navbar, Dropzone, ResultsDashboard, PrivacyNotice
│   │   │   ├── services/api.ts  # Typed API client with upload progress
│   │   │   └── types/           # Detection result TypeScript interfaces
│   │   ├── package.json
│   │   ├── tailwind.config.js
│   │   └── tsconfig.json
│   │
│   └── extension/               # Chrome Extension Manifest V3
│       ├── src/
│       │   ├── background.ts    # Service worker with context-menu listener
│       │   ├── popup.html       # Extension popup HTML
│       │   ├── popup.css        # Extension styles
│       │   ├── popup.ts         # Popup interactive logic
│       │   ├── manifest.json    # Manifest V3 configuration
│       │   └── types.ts
│       ├── test/
│       │   └── extension.test.js# Automated manifest & API communication tests
│       ├── build.js             # esbuild bundle script
│       └── package.json
│
├── .env.example                 # Root environment placeholder template
├── .gitignore                   # Ignores temp files, uploads, node_modules, .env
└── README.md                    # Setup and reference manual
```

---

## Prerequisites

1. **Python**: Python 3.10+ (tested on Python 3.14).
2. **Node.js**: Node.js 18+ (tested on Node.js 20 LTS).
3. **Sightengine API Credentials**: A free or paid account at [sightengine.com](https://sightengine.com/).
4. *(Optional)* **FFmpeg/FFprobe**: Used for video duration validation if available on system PATH (a pure-Python MP4 atom parser is also built-in as an automated fallback).

---

## Sightengine API Setup

1. Sign up for a free account at [https://sightengine.com/signup](https://sightengine.com/signup).
2. Go to your Sightengine Dashboard to find your:
   - **API User**
   - **API Secret**
3. Create a `.env` file inside `apps/api/` or the project root:

```env
SIGHTENGINE_API_USER=your_real_api_user
SIGHTENGINE_API_SECRET=your_real_api_secret
API_BASE_URL=http://localhost:8000
```

> **Note**: If credentials are omitted or left blank, the application will start normally and all automated mock tests will pass. When a user attempts a live scan without credentials, the system returns a clear `503 Service Unavailable` error explaining how to configure the API key.

---

## Installation & Setup

### Windows PowerShell

```powershell
# Navigate to the workspace
cd C:\Users\admin\.gemini\antigravity\scratch\mediacheck-ai

# 1. Install Backend Dependencies
python -m pip install -r apps/api/requirements.txt

# 2. Install Web Frontend Dependencies
cd apps/web
npm install
cd ../..

# 3. Install Extension Dependencies & Build Extension
cd apps/extension
npm install
npm run build
cd ../..
```

### Linux / macOS

```bash
# Navigate to the workspace
cd mediacheck-ai

# 1. Install Backend Dependencies
python3 -m pip install -r apps/api/requirements.txt

# 2. Install Web Frontend Dependencies
cd apps/web && npm install && cd ../..

# 3. Install Extension Dependencies & Build
cd apps/extension && npm install && npm run build && cd ../..
```

---

## Running the Application

### 1. Start the Backend API (FastAPI)

```bash
cd apps/api
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The FastAPI documentation is accessible at:
- Interactive Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- Provider Status: [http://localhost:8000/api/health/provider](http://localhost:8000/api/health/provider)

### 2. Start the Frontend Website (Next.js)

In a separate terminal:

```bash
cd apps/web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## Building & Installing the Chrome Extension

1. Build the extension bundle:
   ```bash
   cd apps/extension
   npm run build
   ```
   This generates the production extension package in `apps/extension/dist/`.

2. Open Google Chrome and enter `chrome://extensions` in the address bar.
3. Turn on **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the folder:
   ```
   C:\Users\admin\.gemini\antigravity\scratch\mediacheck-ai\apps\extension\dist
   ```
6. The MediaCheck AI icon will appear in your Chrome toolbar.
7. **To test on any website**: Right-click an image on any webpage and select **"Check image with MediaCheck AI"**.

---

## Automated Testing

### Backend Test Suite (Pytest)

The test suite covers file signature validation, size and duration limits, mocked Sightengine responses, rate limiting, and unconfigured states:

```bash
cd apps/api
python -m pytest -v
```

*Output (23 tests passed):*
```
tests/test_api.py::test_health_endpoint PASSED
tests/test_api.py::test_provider_health_endpoint PASSED
tests/test_api.py::test_analyze_image_missing_credentials PASSED
tests/test_api.py::test_analyze_image_success_mock PASSED
tests/test_api.py::test_analyze_video_invalid_format PASSED
tests/test_provider.py::test_categorize_score_high_ai PASSED
tests/test_provider.py::test_categorize_score_low_ai PASSED
tests/test_provider.py::test_categorize_score_inconclusive PASSED
tests/test_provider.py::test_detect_image_unconfigured PASSED
tests/test_provider.py::test_detect_image_mock_sightengine_success PASSED
tests/test_provider.py::test_detect_video_mock_sightengine_success PASSED
tests/test_validation.py::test_validate_valid_jpeg PASSED
tests/test_validation.py::test_validate_valid_png PASSED
...
============================= 23 passed in 1.86s ==============================
```

### Extension Test Suite

```bash
cd apps/extension
npm test
```

*Output (4 tests passed):*
```
✔ Extension manifest exists and has valid V3 configuration
✔ Built background.js and popup.js exist and are not empty
✔ Extension API mock integration logic test
✔ Extension settings defaults are valid and secure
```

### Frontend Production Build Test

```bash
cd apps/web
npm run build
```

---

## Example API Requests

### 1. Health Status

```bash
curl -X GET http://localhost:8000/api/health
```

**Response:**
```json
{
  "status": "ok",
  "app": "MediaCheck AI",
  "version": "1.0.0",
  "provider_configured": true
}
```

### 2. Provider Capabilities Check

```bash
curl -X GET http://localhost:8000/api/health/provider
```

### 3. Analyze Image

```bash
curl -X POST http://localhost:8000/api/analyze/image \
  -F "file=@/path/to/sample.jpg"
```

**Response:**
```json
{
  "id": "e7b0a88e-4a6c-48c0-a7d0-1e5bdf8d79a2",
  "category": "AI-generated signals detected",
  "score": 0.962,
  "score_percentage": 96.2,
  "confidence_label": "High confidence AI signals detected (96.2%)",
  "provider": "Sightengine",
  "method": "Sightengine genai model (POST /1.0/check.json)",
  "generator_scores": {
    "midjourney": 0.91
  },
  "provenance": {
    "has_credentials": false,
    "format": "None",
    "status": "No Manifest Detected",
    "summary": "No Content Credentials / C2PA manifest found."
  },
  "explanation": "The detector identified structural, frequency, or textural patterns typical of generative AI models with an API score of 0.962 (96.2%).",
  "limitations": [
    "AI detection is probabilistic and cannot guarantee 100% accuracy.",
    "Heavy compression, resizing, filtering, or noise may obscure generative artifacts.",
    "Absence of AI signals never proves authentic human capture."
  ],
  "file_info": {
    "filename": "sample.jpg",
    "file_size_bytes": 104520,
    "file_size_formatted": "102.1 KB",
    "mime_type": "image/jpeg",
    "media_type": "image",
    "width": 1024,
    "height": 1024
  },
  "analyzed_at": "2026-10-20T11:45:00.000Z"
}
```

---

## Result Categories & Scientific Interpretation

MediaCheck AI maps raw detector scores to three distinct categories:

1. **AI-generated signals detected**: The detector identified significant structural or textural patterns characteristic of generative AI models (score $\ge 0.65$).
2. **No AI-generated signals detected**: The detector did not find sufficient generative anomalies (score $\le 0.35$). **Crucial note**: This does not prove the file is human-captured; advanced generative models or post-processed images may evade detection.
3. **Inconclusive**: The result is borderline ($0.35 < \text{score} < 0.65$), unsupported, or conflicting.

> **Responsible Disclosure**: Raw API scores reflect probabilistic pattern recognition, not legal or ontological certainty. MediaCheck AI never asserts human capture based solely on the absence of detection signals.

---

## Privacy & Security Controls

- **Zero Persistence**: All uploaded files are analyzed in RAM or in isolated temporary files created via Python's `tempfile.mkstemp` and removed in a guaranteed `try...finally` block.
- **Sanitization**: Filenames are sanitized to prevent directory traversal (`..`, slashes, and control characters are stripped).
- **Signature Verification**: Files must pass magic byte header inspection (JPEG, PNG, WebP, MP4, WebM) before being sent to the AI engine.
- **Rate Limiting**: Sliding window rate limiter (default 60 requests/minute per client IP) defends against denial of service.
- **CORS Protection**: Access is restricted to `localhost:3000`, `127.0.0.1:3000`, and `chrome-extension://*` development origins.

---

## Troubleshooting & Limitations

- **"Sightengine API Key Required"**:
  Ensure you have created `apps/api/.env` with valid `SIGHTENGINE_API_USER` and `SIGHTENGINE_API_SECRET` values, then restart the FastAPI server.
- **Video Duration Limit**:
  Synchronous video detection requires clips under 60 seconds (`MAX_VIDEO_DURATION_SECONDS=60`). For longer clips, trim the video before uploading.
- **Cross-Origin Web Images in Extension**:
  Some web servers forbid hotlinking (`CORB`/`CORS` headers). When an image cannot be fetched directly from a third-party webpage, save the image file to your disk and upload it through the extension popup.
- **Content Credentials (C2PA)**:
  Content Credentials require supported JUMBF or XMP metadata blocks. Note that major social platforms (Twitter, Instagram, Reddit) routinely re-encode media upon upload and strip metadata.
