# Four-to-six-minute demonstration

Before presenting, start both servers, open the app, verify System operational, and rehearse camera permissions. Keep an upload photo ready as a fallback. Use an ordinary/private window for guest/employee and a second browser window for admin to avoid switching accounts mid-explanation. Session tokens are tab-scoped.

1. **0:00–0:35 — Product.** “VisionOps AI turns pretrained computer vision into a usable, observable system.” Continue as Guest. Point out that operational/admin pages are not available to guests.
2. **0:35–1:20 — Inference.** Choose Urban street, or upload a clear photo. Analyze. Show boxes, confidence, threshold, and measured inference time. State that confidence is not a guarantee of correctness. Toggle Original image.
3. **1:20–2:00 — Persistence.** Sign in as Employee. Reopen a historical result, point out its demo label, and expand Technical details to show the weight fingerprint/version and coordinates. Capture and analyze a webcam still if permitted; otherwise use upload.
4. **2:00–3:00 — Operations.** Open Analytics. Show request volume, P50/P95, confidence distribution, class counts, and service status. Switch All data to Live only. “These values are calculated from our own stored request activity; seeded history is separately labeled.”
5. **3:00–3:35 — Quality.** Open Model performance. “The published COCO benchmark describes the pretrained model. We have not run a labeled application evaluation, so precision/recall are not invented here.”
6. **3:35–4:45 — Human review.** Mark a real result Incorrect with a reason and comment. Sign in as Admin, open Reported predictions, and inspect that exact prediction. Mark it reviewed or a dataset candidate. “This collects traceable feedback; it does not automatically retrain YOLO.”
7. **4:45–5:30 — Architecture.** Show system health. Mention that `/metrics` exposes authenticated Prometheus counters/histograms; the core app does not depend on Prometheus/Grafana. Explain one-time model loading, backend authorization, and configurable persistence.

The Golden Retriever portrait currently provides a genuine example of a model mistake in the tested environment. Do not promise any fixed output: detections depend on the weights, threshold, and image. If showing this example, explain the observed output honestly.

## Files to understand first

- `backend/app/main.py` — lifecycle and instrumentation.
- `backend/app/ml/service.py` — initialization, lock, timing, explicit fixture mode.
- `backend/app/auth/security.py` — JWT validation and role dependencies.
- `backend/app/api/predictions.py` — request workflow, history scope, feedback.
- `backend/app/models/entities.py` — persistence and provenance.
- `backend/app/services/analytics.py` — scope, histogram bins, percentiles.
- `backend/app/services/storage.py` — safe storage and validation.
- `frontend/src/pages/Analyze.tsx` — upload and camera state handling.
- `frontend/src/components/PredictionView.tsx` — boxes, explanations, reports.

Be candid about local-demo limits: single process, serial inference, no application evaluation, no production account lifecycle, no automatic retention, and no deployed cloud infrastructure.
