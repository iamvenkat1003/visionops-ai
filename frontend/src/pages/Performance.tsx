import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Cpu,
  Info,
  Layers3,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useResource } from "../hooks/useResource";
import type { ModelPerformance } from "../services/types";
import {
  Badge,
  CardTitle,
  ErrorNotice,
  Metric,
  PageHeading,
  Skeleton,
} from "../components/Common";
import { percent } from "../services/utils";

export function Performance() {
  const {
    data: m,
    loading,
    error,
    refresh,
  } = useResource<ModelPerformance>("/api/model/performance");
  return (
    <>
      <PageHeading
        eyebrow="MODEL QUALITY"
        title="Know the model. Know its limits."
        description="Evaluation measures what a model can do. Observability measures how the service runs."
        actions={
          <Link className="text-link" to="/analytics">
            Service analytics <ArrowUpRight size={16} />
          </Link>
        }
      />
      {error && <ErrorNotice message={error} retry={() => void refresh()} />}
      {loading ? (
        <Skeleton />
      ) : (
        m && (
          <>
            <section className="card model-overview">
              <div className="model-overview-intro">
                <div className="model-icon">
                  <Cpu size={29} />
                </div>
                <div>
                  <div className="eyebrow">ULTRALYTICS · OBJECT DETECTION</div>
                  <h2>
                    YOLO11n{" "}
                    <Badge tone={m.demo_mode ? "amber" : "green"}>
                      {m.status}
                    </Badge>
                  </h2>
                  <p>
                    A lightweight, pretrained detector for 80 common COCO
                    classes.
                  </p>
                </div>
              </div>
              <div className="model-specs">
                <div>
                  <span>Parameters</span>
                  <strong>{m.published.parameters_millions}M</strong>
                </div>
                <div>
                  <span>Input size</span>
                  <strong>{m.input_size} px</strong>
                </div>
                <div>
                  <span>Default threshold</span>
                  <strong>{percent(m.confidence_threshold)}</strong>
                </div>
                <div>
                  <span>Execution device</span>
                  <strong>{m.device.toUpperCase()}</strong>
                </div>
              </div>
              <div className="model-version">
                <span>LOADED MODEL VERSION</span>
                <code>{m.version}</code>
              </div>
            </section>
            <div className="section-heading">
              <div>
                <h2>Published benchmark</h2>
                <p>
                  External reference metrics from Ultralytics, evaluated on{" "}
                  {m.published.dataset}.
                </p>
              </div>
              <Badge>
                <BookOpen size={13} />
                Published reference
              </Badge>
            </div>
            <div className="metrics-grid four">
              <Metric
                label="mAP@50–95"
                value={percent(m.published.map50_95)}
                note="COCO validation · 640 px input"
              />
              <Metric
                label="mAP@50"
                value="—"
                note="Not provided in this reference"
              />
              <Metric
                label="Precision"
                value="—"
                note="Not provided in this reference"
              />
              <Metric
                label="Recall"
                value="—"
                note="Not provided in this reference"
              />
            </div>
            <div className="reference-note">
              <Info size={16} />
              <span>
                These are published reference results, not measurements from
                this application. Your images and conditions may produce
                different results.
              </span>
              <a href={m.published.source} target="_blank" rel="noreferrer">
                View source <ArrowUpRight size={14} />
              </a>
            </div>
            <div className="two-column">
              <section className="card evaluation-card">
                <CardTitle
                  title="Application evaluation"
                  subtitle="Metrics measured on your labeled dataset"
                >
                  <Badge tone="amber">Not evaluated</Badge>
                </CardTitle>
                <div className="evaluation-empty">
                  <Layers3 size={32} />
                  <h3>Good metrics need ground truth.</h3>
                  <p>
                    Precision, recall, and mAP require a labeled evaluation set.
                    This application does not yet run that evaluation, so these
                    metrics are intentionally unavailable.
                  </p>
                </div>
                <div className="evaluation-footer">
                  <CheckCircle2 size={16} />
                  Confidence scores are never presented as model accuracy.
                </div>
              </section>
              <section className="card">
                <CardTitle
                  title="Human feedback signals"
                  subtitle="Live predictions only · reports, not accuracy"
                />
                <div className="feedback-stats">
                  <div>
                    <strong>{m.application.feedback_count}</strong>
                    <span>Total assessments</span>
                  </div>
                  <div>
                    <strong className="green-text">
                      {m.application.correct_reports}
                    </strong>
                    <span>Marked correct</span>
                  </div>
                  <div>
                    <strong>{m.application.incorrect_reports}</strong>
                    <span>Reported incorrect</span>
                  </div>
                </div>
                <p className="padded-description">
                  People can report a wrong class, a missed object, or an
                  inaccurate box. Reports remain attached to the original image
                  and model version for review.
                </p>
                <div className="notice neutral">
                  <Info size={16} />
                  <span>
                    Feedback is a biased, potentially repeated human signal. It
                    does not automatically retrain the model or estimate
                    accuracy.
                  </span>
                </div>
              </section>
            </div>
            <section className="quality-explainer">
              <div>
                <span>01</span>
                <h3>Model quality</h3>
                <p>“How well does it detect objects?”</p>
                <small>
                  Measured with labeled data: mAP, precision, recall.
                </small>
              </div>
              <div>
                <span>02</span>
                <h3>Service behavior</h3>
                <p>“How reliably does it serve predictions?”</p>
                <small>
                  Measured here: latency, throughput, errors, and usage.
                </small>
              </div>
              <div>
                <span>03</span>
                <h3>Human perspective</h3>
                <p>“Where should we take a closer look?”</p>
                <small>
                  Collected here: feedback and reviewed dataset candidates.
                </small>
              </div>
            </section>
          </>
        )
      )}
    </>
  );
}
