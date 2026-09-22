# VisionOps AI

**Computer Vision Intelligence & Observability**

A local-first, end-to-end computer vision application: real YOLO11n object detection, authenticated image review, operational analytics, and a human feedback loop. Built for a clear, reproducible engineering interview demonstration on macOS.

## Quick start on macOS

Use **Python 3.12** and **Node.js 22 or 24**. Apple Silicon is supported; CUDA is not required. CPU is the default. Run commands from the repository root unless stated otherwise.

```bash
# If Python 3.12 is unavailable and you have uv:
uv python install 3.12
uv venv --python 3.12 backend/.venv

# Or use an existing Python 3.12 installation:
python3.12 -m venv backend/.venv
```

Backend setup and startup:

```bash
cd backend
source .venv/bin/activate
python -m pip install -r requirements-lock.txt
cp ../.env.example .env
python -m app.setup_model
python -m app.setup_demo
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The lock file records the tested macOS/Python 3.12 environment. For another supported platform, `requirements.txt` provides the direct dependency constraints. Model setup downloads the official `yolo11n.pt` weights once. Sample setup is optional and requires internet the first time. Normal application startup and inference work offline once the model is downloaded.

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. FastAPI documentation: **http://127.0.0.1:8000/docs**.

The frontend proxies `/api` and `/metrics` to port 8000. Vite uses a strict port so an accidental second server does not silently change the demonstration URL. Stop another process on port 5173 before starting.

## Demo accounts

These are deliberately public, **local demonstration credentials**, not real account secrets. Passwords are stored as Argon2 hashes in the database.

| Role | Email | Password |
| --- | --- | --- |
| Employee | `employee@visionops.local` | `EmployeeDemo!2026` |
| Administrator | `admin@visionops.local` | `AdminDemo!2026` |
| Guest | Click **Continue as Guest** | No password |

The login screen can fill the demo credentials under “Using the local demo?”. Account seeding is idempotent and does not replace existing password hashes. Set password environment overrides before initializing a fresh database. Before any public deployment, replace the demo credentials, remove the UI credential helper, configure secrets, and add operational safeguards described below.

## Features and roles

- Drag/drop, file selection, and browser webcam still capture; preview and adjustable confidence threshold.
- Real inference with image-aligned SVG bounding boxes, confidence, detection coordinates, and model version.
- Reopen images and normalized detection records from searchable, filterable, paginated history.
- Correct/incorrect judgments, structured reasons, comments, and administrator review states.
- Database-derived charts: volume, P50/P95 latency, top classes, confidence distribution, outcomes, role usage, recent requests.
- Explicit live/demo filters, ten-second refresh, stale snapshot notices, system health.
- Model quality page distinguishes published benchmarks, unmeasured evaluation metrics, and human feedback signals.
- General product feedback, nontechnical help, responsive layouts, light/dark themes, accessible controls, and friendly errors.
- Prometheus-compatible counters/histograms, without requiring Prometheus or Grafana.

| Capability | Guest | Employee | Admin |
| --- | --- | --- | --- |
| Analyze/upload/camera/current results/help | Yes | Yes | Yes |
| History and stored images | Current session results only | Own predictions | Workspace-wide |
| Analytics / model performance | No | Personal scope | Workspace-wide |
| Prediction and product feedback | No | Yes | Yes |
| Review reports / users / system details | No | No | Yes |

Permissions are enforced by FastAPI dependencies and ownership checks, including image downloads. React route guards also enforce the intended navigation. Guest accounts are separate, random database identities; another guest cannot read their predictions. Logging out removes the tab’s token. JWTs expire after eight hours by default; there is no server-side token revocation yet.

## Architecture

```mermaid
flowchart LR
  Browser[React + TypeScript] --> API[FastAPI + JWT / RBAC]
  API --> Service[Prediction service]
  Service --> Model[YOLO11n: loaded once]
  Service --> DB[(SQLAlchemy / SQLite)]
  Service --> Files[Local image storage]
  DB --> Review[History / Analytics / Feedback]
  API --> Metrics[/metrics]
  Metrics -. future .-> Prometheus
  Prometheus -. future .-> Grafana
```

- `backend/app/main.py`: lifespan, middleware, safe exception handling, routers, metrics endpoint.
- `backend/app/ml/service.py`: model interface, one-time initialization, warm-up, thread-safe inference, explicit synthetic mode.
- `backend/app/api/predictions.py`: validation, persistence, history filters, access-controlled images, feedback.
- `backend/app/models/entities.py`: users, predictions, detections, prediction feedback, product feedback.
- `backend/app/services/analytics.py`: scoped database aggregation and interpolated percentiles.
- `backend/app/auth/security.py`: Argon2 hashing, expiring JWTs, backend role checks.
- `backend/app/services/storage.py`: storage abstraction, safe filenames, EXIF stripping, image integrity checks.
- `frontend/src/pages/Analyze.tsx` and `components/PredictionView.tsx`: upload/camera, workflow states, scalable overlays, review controls.

See [architecture decisions](docs/ARCHITECTURE.md), [interview walkthrough](docs/INTERVIEW.md), and [verification record](docs/VERIFICATION.md).

## Repository layout

```text
backend/
  app/{api,auth,core,db,ml,models,schemas,services}/
  app/setup_model.py
  app/setup_demo.py
  tests/
  requirements.txt           # Direct constraints
  requirements-lock.txt      # Tested environment snapshot
frontend/
  src/{components,hooks,pages,services}/
  src/components/ui/         # shadcn-style Radix/CVA button primitive
  src/index.css             # Themes and responsive layout, Tailwind entry
  package-lock.json
  Dockerfile
  nginx.conf
demo_assets/ATTRIBUTION.json # Sources, authors, licenses; no uploaded images
docs/
.env.example
compose.yaml
```

Technology: React, TypeScript, Vite, Tailwind CSS, a shadcn-style Radix/CVA component primitive, Lucide, Recharts, Sonner; Python, FastAPI, Pydantic, SQLAlchemy, SQLite, Ultralytics/PyTorch, Pillow, Argon2, PyJWT, prometheus-client. The CSS presentation layer is intentionally explicit and easy to customize rather than a large component framework.

## Configuration and data

Copy `.env.example` to `backend/.env`. Run backend commands from `backend/`; relative paths resolve there.

| Setting | Default / meaning |
| --- | --- |
| `DATABASE_URL` | `sqlite:///./data/visionops.db` |
| `DATA_DIR` | `./data` |
| `JWT_SECRET` | Blank creates `data/.jwt-secret`, permission mode 0600 |
| `JWT_EXPIRY_MINUTES` | `480` |
| `CORS_ORIGINS` | JSON list of localhost frontend origins |
| `DEMO_MODE` | `false`; true enables clearly labeled synthetic fixtures |
| `SEED_DEMO_USERS` | `true` |
| `MODEL_PATH` | `./data/models/yolo11n.pt` |
| `MODEL_DEVICE` | `cpu`; `mps` is opt-in and has not been verified here |
| `CONFIDENCE_THRESHOLD` | `0.25`; requests may use 0.05–0.95 |
| `MAX_UPLOAD_MB` | `10`; the UI assumes this local-demo default |
| `METRICS_TOKEN` | Optional bearer token for a future Prometheus scraper |

**Model version** includes a SHA-256 prefix of the weights and the installed Ultralytics version. Every prediction retains that version and its threshold. No model switching or training is implemented.

**Database initialization:** tables and demo accounts are created at application startup or demo setup. `create_all` initializes a new database; it is not a schema migration system. Before modifying a persisted schema, introduce Alembic migrations.

**PostgreSQL:** set `DATABASE_URL=postgresql+psycopg://user:password@host/database`. Business queries use SQLAlchemy and remain database-independent. PostgreSQL connectivity/schema behavior is prepared but has not been integration-tested. Moving existing SQLite records requires an explicit migration; changing the URL does not copy data.

**Images:** `backend/data/uploads/<random-uuid>.jpg`, served only through authenticated ownership-checked API routes. EXIF/GPS metadata is removed. SVG overlays reconstruct annotations from relational detections rather than duplicating image files. The local storage interface is a replacement boundary for an S3 implementation; no S3 implementation exists yet.

**Privacy:** employee images are visible to their owner and administrators. Guest images are also retained for administrator review. No automatic retention/deletion schedule is implemented. Do not use sensitive or identifying images for the demo. JWTs stay in `sessionStorage`; this is convenient for a local demo but is not a hardened production authentication design.

## Sample images and seeded history

```bash
cd backend
source .venv/bin/activate
python -m app.setup_demo                  # Idempotent: fetch assets and seed once
python -m app.setup_demo --offline        # Use existing files
python -m app.setup_demo --offline --reset # Replace ONLY seeded history
```

The collection includes 20 distinct Wikimedia Commons photos, covering street scenes, pets, bicycles, people, interiors, cups, bottles, furniture, and cars. Author credits and source/license links appear in the UI; full attribution and transformations are in [ATTRIBUTION.json](demo_assets/ATTRIBUTION.json). Images remain in ignored runtime storage. On fresh clones, the downloader uses the pinned manifest; unavailable optional images are skipped.

Seeded detections are produced by **real YOLO11n inference**, with actual inference timings. Historical timestamps and a few feedback comments are illustrative. Every seeded prediction has `is_demo_data=true` and `input_source=seed`. Reset removes only those seed records, linked feedback, and their copied upload files; it preserves live predictions and accounts. A live user analysis of a sample photo is a genuine new request and is marked live.

`DEMO_MODE=true` is a separate development fixture: deterministic synthetic boxes, version `demo-fixture-v1`, zero measured inference time, and visible demo labels. Real-model errors never silently switch modes. Seed generation refuses synthetic mode.

## Prediction and feedback workflow

1. Authentication resolves the user from a signed, expiring token. Roles are read from the database.
2. The request body is bounded before multipart parsing. File size, extension, MIME, decoded format, dimensions, and image integrity are validated.
3. The image is re-encoded without metadata and assigned a random storage key.
4. The already-loaded model runs under a lock, protecting Ultralytics’ mutable predictor state.
5. Prediction and normalized detection rows are committed; the response contains coordinates and an authorized image URL.
6. Correctness feedback references both `prediction_id` and `user_id`. Review retains the source image, detections, model version, original comment, reviewer, review note, and timestamp.
7. Administrators mark a report reviewed, dismissed, or a dataset candidate. **This never retrains the model.** Candidates need corrected labels, usage-rights checks, and offline evaluation before any future training process.

## Analytics and model-quality metrics

Operational values are calculated from permitted stored prediction attempts. Employees see their own data; admins see all roles. Time and live/demo filters apply to every chart and KPI. Successful prediction latency percentiles use sorted raw samples with linear interpolation at `(n - 1) * q`. Empty datasets return `null`/“—”, never fabricated values. Average confidence is detection-weighted; it does not average empty predictions as zero-confidence objects.

- **Inference latency:** preprocessing + forward pass + postprocessing inside the model call; excludes waiting for the inference lock, storage, network, and HTTP serialization.
- **Stored server processing:** from request middleware entry through validation/inference/storage preparation; excludes the final DB commit and response transfer. Labeled accordingly in the UI.
- **HTTP histogram:** broader server request handling, including commit/response preparation. It is not browser network latency.
- **Error rate:** failed persisted prediction attempts / total persisted prediction attempts. Auth/form rejections and requests rejected before entering the prediction route are represented only in HTTP telemetry.
- **Published quality:** Ultralytics reports YOLO11n COCO mAP@50–95 of 39.5% at 640 input, with 2.6M parameters. [Official model reference](https://docs.ultralytics.com/models/yolo11/).
- **Unmeasured quality:** mAP@50, precision, recall, and application evaluation are unavailable; no labeled evaluation has run here. Confidence and human reports are not accuracy.

Aggregation loads the selected rows at demo scale and refreshes every ten seconds while visible. This is intentionally simple; production scale would require database aggregations, retention, pagination/limits on review lists, and/or precomputed rollups.

## Prometheus telemetry

`GET /metrics` accepts an admin JWT or the configured `METRICS_TOKEN`. Guests and employees are denied access to system telemetry.

```bash
# After setting METRICS_TOKEN in backend/.env and restarting:
curl -H "Authorization: Bearer $METRICS_TOKEN" http://127.0.0.1:8000/metrics
```

Metrics: `visionops_requests_total`, `visionops_predictions_total`, `visionops_prediction_errors_total`, `visionops_inference_latency_seconds`, and `visionops_request_latency_seconds`. Counters reset on process restart; database analytics persist. Route template labels avoid per-prediction ID cardinality. Synthetic mode is labeled in the prediction counter; offline history seeding does not inflate process counters. Use one Uvicorn worker for this demo.

Future integration: **FastAPI → `/metrics` → Prometheus → Grafana**. A scraper should use its own secret bearer token. Neither service is required, installed, or running as part of the core application.

## Verification

```bash
cd backend
source .venv/bin/activate
python -m pytest -q
ruff check app tests
ruff format --check app tests

# With the real backend running and sample setup complete:
python tests/real_model_smoke.py

cd ../frontend
npm run typecheck
npm run lint
npm run build
```

The normal backend suite uses deterministic fixtures and a temporary database, without downloading weights. The separate real-model smoke check creates one live test prediction and an explicitly identified test feedback report. See [VERIFICATION.md](docs/VERIFICATION.md) for results and remaining manual checks.

## Docker (secondary, optional)

Docker files are included for a separate frontend and Python model server. The local macOS workflow is the verified path. Container builds have not been run on this machine.

```bash
docker compose build
docker compose run --rm backend python -m app.setup_model
docker compose run --rm backend python -m app.setup_demo
docker compose up
```

Open http://127.0.0.1:8080. A named volume retains the database, model, secret, and images. Both containers run as unprivileged users. The frontend serves static Vite output and proxies API requests to FastAPI. Environment overrides should be configured before deployment.

## Future deployment

```text
Vercel / static frontend hosting
    React built with VITE_API_URL=https://api.example.com
             |
Container-capable backend hosting
    FastAPI + PyTorch + YOLO11n
             |-- PostgreSQL
             |-- Object storage (future adapter)
             |-- /metrics -> Prometheus -> Grafana
```

The YOLO server is a long-running container workload, not a conventional Vercel frontend/serverless deployment. Configure HTTPS, explicit CORS, persistent storage, private metrics, account provisioning, rate limits, secret management, backups, and migrations before exposing it publicly. GitHub publication of the source is separate from deploying the running service.

## Troubleshooting and limitations

- **Model unavailable:** run `python -m app.setup_model` from `backend/`, then restart. The health endpoint remains available when model startup fails.
- **Cannot reach backend:** start Uvicorn on 8000 and Vite on 5173. Check the terminal for startup/port errors.
- **Camera unavailable:** grant browser permission on localhost/HTTPS; close other camera apps. Upload is always available. Physical webcam access should be rehearsed on the presentation machine/browser.
- **No detections / wrong class:** this is possible and expected. Try the urban street sample or a clear image with common objects. Demonstrate the review workflow rather than treating confidence as correctness.
- **Invalid credentials after changing `.env`:** existing accounts are not overwritten by seed logic. Use the existing credentials or provision/change accounts deliberately.
- **Guest images remain:** there is no automatic cleanup yet. Store only nonsensitive demo images.
- **Scale:** one model process, serialized inference, demo-scale aggregation; no distributed queue or inference fleet.
- **Security:** no signup/reset workflow, rate limiting, refresh-token rotation, revocation, security audit, or production account provisioning yet. Public demo defaults must be replaced before deployment.
- **DB/files:** storage and SQL are not one atomic transaction; a DB failure after saving an image can leave an orphan file. A production cleanup/reconciliation job is a future improvement.
- **Review/admin lists:** capped at 200 newest entries; historical prediction browsing is paginated.
- **Accessibility:** labeled controls, keyboard focus, native details/selects, and reduced-motion support; no formal WCAG audit yet.
- **Dependencies/licenses:** Ultralytics is AGPL-3.0 with enterprise licensing options; review its terms before external commercial distribution. Sample photos retain their individual CC/Public Domain licenses. No application distribution license has been selected for this private repository.

## Screenshots

Screenshot placeholders: Analyze workspace, annotated prediction, operational analytics, model performance, and administrator review. Capture only nonsensitive sample images and retain their attribution when sharing.
