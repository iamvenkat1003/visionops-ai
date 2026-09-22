from prometheus_client import Counter, Histogram

requests = Counter("visionops_requests_total", "HTTP requests", ["method", "route", "status"])
predictions = Counter("visionops_predictions_total", "Prediction attempts", ["status", "mode"])
prediction_errors = Counter("visionops_prediction_errors_total", "Failed predictions", ["error_type"])
inference_latency = Histogram(
    "visionops_inference_latency_seconds",
    "Model preprocess + inference + postprocess",
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10),
)
request_latency = Histogram(
    "visionops_request_latency_seconds",
    "Full server request duration",
    ["route"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30),
)
