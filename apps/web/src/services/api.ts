import { DetectionResult, ProviderStatus } from '../types/detection';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export async function fetchProviderStatus(): Promise<ProviderStatus> {
  try {
    const res = await fetch(`${API_BASE}/api/health/provider`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`API returned HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    return {
      provider: 'Sightengine',
      is_configured: false,
      image_endpoint: '',
      video_sync_endpoint: '',
      max_video_duration_seconds: 60,
      max_image_size_mb: 20,
      max_video_size_mb: 50,
      message: 'Backend server unreachable. Make sure the FastAPI service is running on port 8000.',
    };
  }
}

export function uploadAndAnalyzeMedia(
  file: File,
  type: 'image' | 'video',
  onProgress?: (percent: number) => void
): Promise<DetectionResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const endpoint = `${API_BASE}/api/analyze/${type}`;

    xhr.open('POST', endpoint);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 90); // 90% is upload, 10% is backend processing
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) onProgress(100);
          resolve(data as DetectionResult);
        } else {
          const errMsg = data.message || data.detail?.message || data.detail || `Server returned error (${xhr.status})`;
          reject(new Error(errMsg));
        }
      } catch (parseErr) {
        reject(new Error(`Server error (${xhr.status}): Unable to parse response.`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error. Failed to connect to MediaCheck API backend at ' + API_BASE));
    };

    xhr.ontimeout = () => {
      reject(new Error('Request timed out. The file might be too large or the server is busy.'));
    };

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}
