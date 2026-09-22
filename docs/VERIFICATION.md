# Verification record

Verified locally on macOS / Apple Silicon, Python 3.12, Node 24.

- Backend: **27 tests passed**; Ruff passed. Tests cover authentication, guest restrictions, employee/admin RBAC, prediction persistence, cross-user image protection, feedback, review, analytics, health, invalid input, and percentiles tested with a temporary database and explicit synthetic fixtures.
- Frontend: TypeScript typecheck, ESLint, and production build passed.
- Real model: official YOLO11n weights loaded and warmed on CPU; 20 sample images processed into labeled seeded history.
- Browser: guest login, real image analysis, bounding-box output, employee/admin login, sample credits, populated analytics, exact reported-prediction reopening, and persisted admin review verified. Dark/light theme controls and the model-quality page were checked at a 390px mobile breakpoint; no horizontal overflow was observed. Logging out redirects a direct /admin request to /login. No warnings/errors were present in the inspected browser console.
- Running-server smoke test: real YOLO → image/database persistence → live analytics count increment → employee feedback → admin report → authenticated /metrics passed. The observed test inference was 43.1 ms on CPU; this is one sample, not a benchmark.
- No cloud deployment has been performed. Docker files are prepared but container builds are not yet verified.

Remaining manual verification: physical webcam permissions/capture and drag/drop using the presentation machine/browser. Prediction creation through sample uploads and the full persistence/review API flow were verified. These device/browser interactions should be rehearsed before the interview.

Run commands are in README.md. `backend/tests/real_model_smoke.py` is an additional opt-in test against the running real backend; it leaves one clearly identified test report in live history.
