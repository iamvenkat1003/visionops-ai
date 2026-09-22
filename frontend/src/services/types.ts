export type Role = "GUEST" | "EMPLOYEE" | "ADMIN";
export interface User {
  id: string;
  name: string;
  email: string | null;
  role: Role;
}
export interface Detection {
  id: number;
  class_id: number;
  class_name: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface PredictionFeedback {
  id: number;
  prediction_id: string;
  user_id: string;
  created_at: string;
  is_correct: boolean;
  reason: string | null;
  comment: string;
  review_status: string;
  review_note: string;
  reviewed_at: string | null;
}
export interface Prediction {
  id: string;
  user_id: string;
  user_name: string;
  role: Role;
  created_at: string;
  model_name: string;
  model_version: string;
  input_source: string;
  original_filename: string;
  image_width: number;
  image_height: number;
  number_of_detections: number;
  average_confidence: number;
  max_confidence: number;
  confidence_threshold: number;
  inference_latency_ms: number;
  total_latency_ms: number;
  status: string;
  error_type: string | null;
  is_demo_data: boolean;
  image_url: string | null;
  detections: Detection[];
  feedback: PredictionFeedback[];
}
export interface Health {
  status: string;
  api: string;
  model: string;
  database: string;
  demo_mode: boolean;
}
export interface ModelInfo {
  name: string;
  version: string;
  status: string;
  demo_mode: boolean;
  device: string;
  confidence_threshold: number;
  input_size: number;
}
export interface Analytics {
  scope: string;
  window: string;
  data: string;
  total_requests: number;
  successful_predictions: number;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
  average_confidence: number | null;
  error_rate: number;
  demo_count: number;
  live_count: number;
  requests_per_minute: number;
  timeseries: {
    timestamp: number;
    requests: number;
    errors: number;
    p50: number | null;
    p95: number | null;
  }[];
  classes: { name: string; count: number }[];
  confidence_distribution: { range: string; count: number }[];
  roles: { name: string; count: number }[];
  recent: Prediction[];
  updated_at: string;
}
export interface SystemInfo extends Health {
  model_info: ModelInfo;
  uptime_seconds: number;
  total_users: number;
  recent_users: number;
  total_predictions: number;
  predictions_today: number;
  feedback_count: number;
  incorrect_reports: number;
  metrics: Analytics;
}
export interface ModelPerformance extends ModelInfo {
  published: {
    map50_95: number;
    map50: null;
    precision: null;
    recall: null;
    parameters_millions: number;
    dataset: string;
    source: string;
    input_size: number;
  };
  application: {
    evaluated_images: number;
    feedback_count: number;
    correct_reports: number;
    incorrect_reports: number;
  };
}
export interface Sample {
  id: string;
  title: string;
  url: string;
  credit: string;
  license: string;
  source: string;
  license_url: string;
}
