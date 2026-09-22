import { useState } from "react";
import {
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  ScanLine,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import { api, errorMessage } from "../services/api";
import type { Prediction } from "../services/types";
import { date, ms, percent } from "../services/utils";
import { Badge, CardTitle, useImage } from "./Common";
import { Button } from "./ui/button";

const colors = ["#60c695", "#76b9ef", "#d9b660", "#c995df", "#ee9981"];
export function DetectionImage({
  prediction,
  original = false,
}: {
  prediction: Prediction;
  original?: boolean;
}) {
  const url = useImage(prediction.image_url);
  if (!url)
    return (
      <div className="result-image-loading">
        <ScanLine size={32} />
        <span>Image unavailable or loading…</span>
      </div>
    );
  const p = prediction;
  return (
    <div className="detection-image">
      <img src={url} alt={`Analyzed image: ${p.original_filename}`} />
      {!original && (
        <svg
          viewBox={`0 0 ${p.image_width} ${p.image_height}`}
          role="img"
          aria-label={`${p.number_of_detections} detected objects with bounding boxes`}
          preserveAspectRatio="xMidYMid meet"
        >
          {p.detections.map((d, i) => {
            const fontSize = Math.max(p.image_width / 65, 11);
            const boxHeight = fontSize * 1.9;
            const label = `${d.class_name} ${(d.confidence * 100).toFixed(0)}%`;
            const width = label.length * fontSize * 0.62 + 12;
            const y = Math.max(boxHeight, d.y1);
            const x = Math.max(0, Math.min(d.x1, p.image_width - width));
            return (
              <g key={d.id}>
                <rect
                  x={d.x1}
                  y={d.y1}
                  width={d.x2 - d.x1}
                  height={d.y2 - d.y1}
                  fill="none"
                  stroke={colors[i % colors.length]}
                  strokeWidth={Math.max(2, p.image_width / 400)}
                />
                <rect
                  x={x}
                  y={y - boxHeight}
                  width={width}
                  height={boxHeight}
                  rx={3}
                  fill={colors[i % colors.length]}
                />
                <text
                  x={x + 6}
                  y={y - boxHeight * 0.3}
                  fill="#12221b"
                  fontWeight="600"
                  fontSize={fontSize}
                  fontFamily="system-ui"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
export function PredictionView({
  prediction,
  onUpdate,
}: {
  prediction: Prediction;
  onUpdate: (p: Prediction) => void;
}) {
  const { user } = useAuth();
  const [original, setOriginal] = useState(false);
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState("Wrong class");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const p = prediction;
  const send = async (correct: boolean) => {
    setBusy(true);
    try {
      const updated = await api<Prediction>(
        `/api/predictions/${p.id}/feedback`,
        {
          method: "POST",
          body: JSON.stringify({
            is_correct: correct,
            reason: correct ? null : reason,
            comment,
          }),
        },
      );
      onUpdate(updated);
      setReport(false);
      setComment("");
      toast.success(
        correct
          ? "Thanks. Your assessment has been saved."
          : "Prediction sent for human review.",
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="prediction-result">
      <div className="result-grid">
        <section className="card result-canvas">
          <div className="canvas-toolbar">
            <span>
              <span
                className={`status-dot ${p.status === "error" ? "warning" : ""}`}
              />
              {p.status === "success" ? "Analysis complete" : "Analysis failed"}
            </span>
            <div>
              {p.is_demo_data && <Badge tone="amber">Demo data</Badge>}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOriginal(!original)}
              >
                {original ? <Eye size={15} /> : <EyeOff size={15} />}
                {original ? "Show detections" : "Original image"}
              </Button>
            </div>
          </div>
          <div className="canvas-body">
            <DetectionImage prediction={p} original={original} />
          </div>
          <div className="canvas-bottom">
            <span>{p.original_filename}</span>
            <span>
              {p.image_width} × {p.image_height} px
            </span>
          </div>
        </section>
        <section className="card results-list">
          <CardTitle
            title="Detected objects"
            subtitle="What the model found in your image"
          >
            <span className="count-bubble">{p.number_of_detections}</span>
          </CardTitle>
          <div className="object-list">
            {p.detections.length ? (
              p.detections.map((d, i) => (
                <div className="object-row" key={d.id}>
                  <span
                    className="object-index"
                    style={{ color: colors[i % colors.length] }}
                  >
                    ▣
                  </span>
                  <div>
                    <strong>{d.class_name}</strong>
                    <div className="confidence-track">
                      <span
                        style={{
                          width: `${d.confidence * 100}%`,
                          background: colors[i % colors.length],
                        }}
                      />
                    </div>
                  </div>
                  <span className="mono">{percent(d.confidence)}</span>
                </div>
              ))
            ) : (
              <div className="no-detections">
                <ScanLine size={25} />
                <h3>
                  {p.status === "error"
                    ? "Request could not complete"
                    : "No objects detected"}
                </h3>
                <p>
                  {p.status === "error"
                    ? "Try analyzing the image again."
                    : "Try a clearer image or a lower confidence threshold. The model recognizes 80 common object classes."}
                </p>
              </div>
            )}
          </div>
          <div className="result-summary">
            <span>
              <Clock3 size={15} /> Model inference{" "}
              <b>{ms(p.inference_latency_ms)}</b>
            </span>
            <span>
              <ScanLine size={15} /> Model <b>{p.model_name}</b>
            </span>
            <span>
              <Check size={15} /> Threshold{" "}
              <b>{percent(p.confidence_threshold)}</b>
            </span>
          </div>
        </section>
      </div>
      <section className="card details-card">
        <CardTitle
          title="Detection details"
          subtitle="A closer look at this prediction"
        />
        <div className="detail-metrics">
          <div>
            <span>Average confidence</span>
            <strong>
              {p.number_of_detections ? percent(p.average_confidence) : "—"}
            </strong>
          </div>
          <div>
            <span>Model inference</span>
            <strong>{ms(p.inference_latency_ms)}</strong>
          </div>
          <div>
            <span>Server processing¹</span>
            <strong>{ms(p.total_latency_ms)}</strong>
          </div>
          <div>
            <span>Analyzed at</span>
            <strong>{date(p.created_at)}</strong>
          </div>
        </div>
        <p className="confidence-explanation">
          Confidence describes how strongly the model associates a box with an
          object class. It is not a guarantee of correctness or an explanation
          of the model’s reasoning.
        </p>
        <small className="muted">
          ¹ Through validation, inference, and storage preparation; excludes
          final database commit, response transfer, and browser time.
        </small>
        {user?.role !== "GUEST" && (
          <details className="technical-details">
            <summary>
              Technical details <ChevronDown size={16} />
            </summary>
            <div className="technical-info">
              <div>
                <span>Prediction ID</span>
                <code>{p.id}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Copy prediction ID"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(p.id)
                      .then(() => toast.success("Prediction ID copied"))
                      .catch(() => toast.error("Clipboard unavailable"))
                  }
                >
                  <Copy size={14} />
                </Button>
              </div>
              <div>
                <span>Model version</span>
                <code>{p.model_version}</code>
              </div>
              <div>
                <span>Input source</span>
                <code>{p.input_source}</code>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Confidence</th>
                    <th>Bounding box [x1, y1, x2, y2]</th>
                  </tr>
                </thead>
                <tbody>
                  {p.detections.map((d) => (
                    <tr key={d.id}>
                      <td>{d.class_name}</td>
                      <td>{percent(d.confidence)}</td>
                      <td className="mono">
                        [{[d.x1, d.y1, d.x2, d.y2].map(Math.round).join(", ")}]
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>
      {user?.role !== "GUEST" && p.status === "success" && (
        <section className="card feedback-card">
          <div>
            <h3>Does this look right?</h3>
            <p>Your feedback helps identify predictions for human review.</p>
          </div>
          <div className="inline-actions">
            <Button
              variant="outline"
              onClick={() => void send(true)}
              disabled={busy}
            >
              <ThumbsUp size={16} />
              Correct
            </Button>
            <Button
              variant={report ? "secondary" : "outline"}
              onClick={() => setReport(!report)}
              disabled={busy}
            >
              <ThumbsDown size={16} />
              Incorrect
            </Button>
          </div>
          {report && (
            <form
              className="report-form"
              onSubmit={(e) => {
                e.preventDefault();
                void send(false);
              }}
            >
              <label htmlFor="report-reason">What went wrong?</label>
              <select
                id="report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {[
                  "Missed object",
                  "Wrong class",
                  "Incorrect bounding box",
                  "Low confidence",
                  "Duplicate detection",
                  "Other",
                ].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <label htmlFor="report-comment">
                Additional context <span className="muted">(optional)</span>
              </label>
              <textarea
                id="report-comment"
                value={comment}
                maxLength={2000}
                placeholder="Tell the reviewer what you see…"
                onChange={(e) => setComment(e.target.value)}
              />
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  "Submit for review"
                )}
              </Button>
              <small>
                This saves a review request. It does not retrain the model.
              </small>
            </form>
          )}
        </section>
      )}
      {p.feedback.length > 0 && (
        <section className="card">
          <CardTitle
            title="Feedback history"
            subtitle="Human judgments retained with this prediction"
          />
          <div className="feedback-timeline">
            {p.feedback.map((f) => (
              <div key={f.id}>
                <span
                  className={`feedback-indicator ${f.is_correct ? "correct" : ""}`}
                >
                  {f.is_correct ? (
                    <ThumbsUp size={15} />
                  ) : (
                    <ThumbsDown size={15} />
                  )}
                </span>
                <div>
                  <strong>
                    {f.is_correct
                      ? "Marked correct"
                      : f.reason || "Marked incorrect"}
                  </strong>
                  <p>{f.comment || "No additional comment."}</p>
                  {f.review_note && <p>Reviewer: {f.review_note}</p>}
                  <small>{date(f.created_at)}</small>
                </div>
                <Badge tone={f.review_status === "pending" ? "amber" : "green"}>
                  {f.review_status.replaceAll("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
