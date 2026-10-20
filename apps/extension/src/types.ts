export interface ExtensionSettings {
  apiBaseUrl: string;
  websiteUrl: string;
}

export interface DetectionResult {
  id: string;
  category: 'AI-generated signals detected' | 'No AI-generated signals detected' | 'Inconclusive';
  score: number | null;
  score_percentage: number | null;
  confidence_label: string;
  provider: string;
  method: string;
  generator_scores: Record<string, number>;
  explanation: string;
  limitations: string[];
  file_info: {
    filename: string;
    file_size_formatted: string;
    mime_type: string;
    media_type: 'image' | 'video';
  };
  analyzed_at: string;
}
