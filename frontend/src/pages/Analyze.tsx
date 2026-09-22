import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  FileImage,
  ImagePlus,
  Info,
  Loader2,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api, errorMessage, imageBlob } from "../services/api";
import type { Prediction, Sample } from "../services/types";
import {
  Badge,
  CardTitle,
  Empty,
  ErrorNotice,
  PageHeading,
  SecureImage,
} from "../components/Common";
import { Button } from "../components/ui/button";
import { PredictionView } from "../components/PredictionView";
import { useResource } from "../hooks/useResource";

function CameraInput({ capture }: { capture: (file: File) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  const start = async () => {
    setError("");
    setBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera access requires a supported browser on localhost or HTTPS.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (!alive.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      setActive(true);
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser, or upload an image."
          : name === "NotFoundError"
            ? "No camera was found. Connect a camera or upload an image."
            : name === "NotReadableError"
              ? "Your camera may be in use by another app. Close it and try again, or upload an image."
              : errorMessage(e),
      );
      stream.current?.getTracks().forEach((t) => t.stop());
      setActive(false);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const snap = () => {
    if (!video.current?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.current.videoWidth;
    canvas.height = video.current.videoHeight;
    canvas.getContext("2d")?.drawImage(video.current, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob && alive.current)
          capture(
            new File([blob], "camera-capture.jpg", { type: "image/jpeg" }),
          );
      },
      "image/jpeg",
      0.92,
    );
  };
  return (
    <div className="camera-input">
      {error && <ErrorNotice message={error} />}
      <video
        ref={video}
        autoPlay
        muted
        playsInline
        onLoadedData={() => setReady(true)}
        className={active ? "" : "hidden-video"}
        aria-label="Live camera preview"
      />
      {!active ? (
        <div className="camera-prompt">
          <span className="upload-icon">
            <Camera size={31} />
          </span>
          <h3>A fresh perspective</h3>
          <p>
            Capture a still frame from your camera.
            <br />
            Video is never streamed to the server.
          </p>
          <Button onClick={() => void start()} disabled={busy}>
            {busy ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Camera size={16} />
            )}
            Enable camera
          </Button>
        </div>
      ) : (
        <div className="camera-controls">
          <Badge tone="green">
            <span className="status-dot" />
            Camera active
          </Badge>
          <Button onClick={snap} disabled={!ready}>
            <Camera size={17} />
            Capture image
          </Button>
        </div>
      )}
    </div>
  );
}

export function Analyze() {
  const [tab, setTab] = useState("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [source, setSource] = useState("upload");
  const [threshold, setThreshold] = useState(0.25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const [result, setResult] = useState<Prediction | null>(null);
  useEffect(() => {
    if (result) window.scrollTo(0, 0);
  }, [result]);
  const input = useRef<HTMLInputElement>(null);
  const { data: samples } = useResource<Sample[]>("/api/samples");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const select = (next: File, method = "upload") => {
    setError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(next.type) ||
      !/\.(jpe?g|png|webp)$/i.test(next.name)
    ) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (next.size > 10 * 1024 * 1024) {
      setError("Please select an image smaller than 10 MB.");
      return;
    }
    if (!next.size) {
      setError("That file is empty. Please choose another image.");
      return;
    }
    setFile(next);
    setSource(method);
    setResult(null);
  };
  const analyze = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("input_source", source);
    form.append("threshold", String(threshold));
    try {
      setResult(
        await api<Prediction>("/api/predictions", {
          method: "POST",
          body: form,
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const sample = async (asset: Sample) => {
    try {
      const blob = await imageBlob(asset.url);
      select(
        new File([blob], `${asset.id}.jpg`, { type: "image/jpeg" }),
        "sample",
      );
    } catch {
      setError(
        "This sample is unavailable. You can still upload your own image.",
      );
    }
  };
  const reset = () => {
    setResult(null);
    setFile(null);
    setError("");
  };
  return (
    <>
      <PageHeading
        eyebrow="COMPUTER VISION WORKSPACE"
        title={result ? "A closer look." : "See beyond the image."}
        description={
          result
            ? "Your image, understood. Explore detections and add your perspective."
            : "Turn images into insights with fast, precise object detection."
        }
        actions={
          result ? (
            <Button variant="outline" onClick={reset}>
              <ImagePlus size={17} />
              Analyze another image
            </Button>
          ) : (
            <Link className="text-link" to="/help">
              How it works <ArrowRight size={16} />
            </Link>
          )
        }
      />
      {error && <ErrorNotice message={error} />}
      {result ? (
        <PredictionView prediction={result} onUpdate={setResult} />
      ) : (
        <>
          <div className="analyze-grid">
            <section className="card upload-card">
              <div
                className="input-tabs"
                role="tablist"
                aria-label="Image source"
              >
                <button
                  role="tab"
                  aria-selected={tab === "upload"}
                  disabled={busy}
                  className={tab === "upload" ? "selected" : ""}
                  onClick={() => {
                    setTab("upload");
                    setFile(null);
                  }}
                >
                  <UploadCloud size={17} />
                  Upload image
                </button>
                <button
                  role="tab"
                  aria-selected={tab === "camera"}
                  disabled={busy}
                  className={tab === "camera" ? "selected" : ""}
                  onClick={() => {
                    setTab("camera");
                    setFile(null);
                  }}
                >
                  <Camera size={17} />
                  Camera
                </button>
                <span className="input-tabs-end">IMAGE INPUT</span>
              </div>
              <div className="upload-content">
                {file ? (
                  <div className="preview-area">
                    <img src={preview} alt="Selected image preview" />
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label="Remove selected image"
                      disabled={busy}
                      onClick={() => setFile(null)}
                    >
                      <X size={16} />
                    </Button>
                    <div className="file-chip">
                      <FileImage size={16} />
                      <span>{file.name}</span>
                      <small>{(file.size / 1024).toFixed(0)} KB</small>
                      <Check size={15} />
                    </div>
                  </div>
                ) : tab === "camera" ? (
                  <CameraInput capture={(f) => select(f, "camera")} />
                ) : (
                  <div
                    className={`dropzone ${dragging ? "dragging" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      const f = e.dataTransfer.files[0];
                      if (f) select(f);
                    }}
                  >
                    <div className="dropzone-corner tl" />
                    <div className="dropzone-corner tr" />
                    <div className="dropzone-corner bl" />
                    <div className="dropzone-corner br" />
                    <span className="upload-icon">
                      <ImagePlus size={34} strokeWidth={1.5} />
                    </span>
                    <h2>Every image has a story.</h2>
                    <p>Drag and drop yours here to discover what’s inside.</p>
                    <Button
                      variant="outline"
                      onClick={() => input.current?.click()}
                    >
                      <UploadCloud size={17} />
                      Choose an image
                    </Button>
                    <small>
                      JPG, PNG or WEBP <span>·</span> Up to 10 MB
                    </small>
                    <input
                      ref={input}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Upload image"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) select(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="analyze-action-bar">
                <span>
                  <ShieldCheck size={16} />
                  Processed locally. Stored securely.
                </span>
                <Button disabled={!file || busy} onClick={() => void analyze()}>
                  {busy ? (
                    <>
                      <Loader2 size={17} className="spin" />
                      Analyzing image…
                    </>
                  ) : (
                    <>
                      <ScanLine size={17} />
                      Analyze image <ArrowRight size={16} />
                    </>
                  )}
                </Button>
              </div>
              {busy && (
                <div className="analysis-progress" role="status">
                  <span />
                  <p>
                    Validating image → running YOLO11n → saving your results
                  </p>
                </div>
              )}
            </section>
            <aside className="analysis-side">
              <section className="card model-card">
                <div className="model-icon">
                  <ScanLine size={25} />
                </div>
                <div className="eyebrow">THE MODEL BEHIND THE VIEW</div>
                <h2>
                  Small model.
                  <br />
                  Big perspective.
                </h2>
                <p>
                  YOLO11n finds everyday objects in a single pass, from people
                  and pets to the things around you.
                </p>
                <div className="model-stats">
                  <div>
                    <strong>80</strong>
                    <span>object classes</span>
                  </div>
                  <div>
                    <strong>640</strong>
                    <span>input resolution</span>
                  </div>
                </div>
                <div className="model-card-footer">
                  <span className="status-dot" />
                  <span>YOLO11n · COCO pretrained</span>
                </div>
              </section>
              <section className="card settings-card">
                <h3>
                  <SlidersHorizontal size={16} />
                  Detection settings
                </h3>
                <label htmlFor="threshold">
                  <span>Confidence threshold</span>
                  <b className="mono">{Math.round(threshold * 100)}%</b>
                </label>
                <input
                  id="threshold"
                  type="range"
                  min="5"
                  max="95"
                  step="5"
                  value={threshold * 100}
                  disabled={busy}
                  onChange={(e) => setThreshold(Number(e.target.value) / 100)}
                />
                <div className="range-labels">
                  <span>More detections</span>
                  <span>Higher confidence</span>
                </div>
                <p>
                  <Info size={14} />
                  25% is a useful starting point. Raise it to show more
                  confident detections.
                </p>
              </section>
            </aside>
          </div>
          <section className="sample-section">
            <CardTitle
              title="Start with a little inspiration"
              subtitle="No image handy? Try one from the sample collection."
            >
              <Badge>Licensed sample assets</Badge>
            </CardTitle>
            {samples?.length ? (
              <div className="sample-grid">
                {samples.slice(0, showSamples ? samples.length : 4).map((s) => (
                  <div key={s.id}>
                    <button
                      className="sample-card"
                      disabled={busy}
                      onClick={() => void sample(s)}
                    >
                      <div>
                        <SecureImage path={s.url} alt={s.title} />
                        <span className="sample-arrow">
                          <ArrowRight size={16} />
                        </span>
                      </div>
                      <strong>{s.title}</strong>
                      <span>
                        {s.license} <ChevronRight size={13} />
                      </span>
                    </button>
                    <p className="sample-credit">
                      <a
                        href={s.source}
                        target="_blank"
                        rel="noreferrer"
                        title={s.credit}
                      >
                        {s.credit}
                      </a>{" "}
                      ·{" "}
                      <a href={s.license_url} target="_blank" rel="noreferrer">
                        License
                      </a>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="Bring your own perspective"
                description="Upload a photo to get started. Optional sample assets can be installed with the demo setup command."
              />
            )}
          </section>
          {!!samples?.length && (
            <Button
              variant="ghost"
              size="sm"
              className="sample-toggle"
              onClick={() => setShowSamples(!showSamples)}
            >
              {showSamples
                ? "Show fewer samples"
                : `Explore all ${samples.length} samples`}
            </Button>
          )}
          <div className="workflow-strip">
            {[
              ["01", "Add an image", "Upload a photo or capture a moment."],
              ["02", "Let the model look", "YOLO11n locates familiar objects."],
              [
                "03",
                "Explore the details",
                "Review detections and share feedback.",
              ],
            ].map(([n, title, description]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <h4>{title}</h4>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
