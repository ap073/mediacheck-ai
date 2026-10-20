export type DetectionCategory =
  | 'AI-generated signals detected'
  | 'No AI-generated signals detected'
  | 'Inconclusive';

export interface FileInfo {
  filename: string;
  file_size_bytes: number;
  file_size_formatted: string;
  mime_type: string;
  media_type: 'image' | 'video';
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  container_format?: string | null;
}

export interface ProvenanceResult {
  has_credentials: boolean;
  format: string;
  status: string;
  summary: string;
  details: Record<string, string>;
  disclaimer: string;
}

export interface VideoFrameScore {
  position_seconds: number;
  score: number;
}

export interface DetectionResult {
  id: string;
  category: DetectionCategory;
  score: number | null;
  score_percentage: number | null;
  confidence_label: string;
  provider: string;
  method: string;
  generator_scores: Record<string, number>;
  frames_summary?: VideoFrameScore[] | null;
  average_frame_score?: number | null;
  peak_frame_score?: number | null;
  provenance?: ProvenanceResult | null;
  explanation: string;
  limitations: string[];
  file_info: FileInfo;
  analyzed_at: string;
}

export interface ProviderStatus {
  provider: string;
  is_configured: boolean;
  image_endpoint: string;
  video_sync_endpoint: string;
  max_video_duration_seconds: number;
  max_image_size_mb: number;
  max_video_size_mb: number;
  message: string;
}
