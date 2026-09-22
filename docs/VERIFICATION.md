# Verification record

Verified locally on macOS / Apple Silicon, Python 3.12, Node 24.

- Backend: **27 tests passed**; Ruff passed. Tests cover authentication, guest restrictions, employee/admin RBAC, prediction persistence, cross-user image protection, feedback, review, analytics, health, invalid input, and percentiles tested with a temporary database and explicit synthetic fixtures.
- Frontend: TypeScript typecheck, ESLint, and production build passed.
- Real model: official YOLO11n weights loaded and warmed on CPU; 20 sample images processed into labeled seeded history.
- Browser: guest login, real image analysis, bounding-box output, employee login, sample credits, and populated analytics verified.
- No cloud deployment has been performed. Docker files are prepared but container builds are not yet verified.

Remaining verification: physical webcam permissions/capture on the presentation browser, full drag/drop interaction, mobile layout review, and a complete employee-report-to-admin-review browser rehearsal. API review flows are covered by automated tests.

Run commands are in README.md. `backend/tests/real_model_smoke.py` is an additional opt-in test against the running real backend; it leaves one clearly identified test report in live history.
