import { useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useResource } from "../hooks/useResource";
import type { Prediction, SystemInfo, User } from "../services/types";
import { api, errorMessage } from "../services/api";
import {
  Badge,
  CardTitle,
  Empty,
  ErrorNotice,
  Metric,
  PageHeading,
  SecureImage,
  Skeleton,
} from "../components/Common";
import { Button } from "../components/ui/button";
import { date, ms, percent } from "../services/utils";

function Reported() {
  const { data, loading, error, refresh } = useResource<Prediction[]>(
    "/api/admin/reported-predictions",
  );
  const [busy, setBusy] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const review = async (id: number, status: string) => {
    setBusy(id);
    try {
      await api(`/api/admin/prediction-feedback/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, note: notes[id] || "" }),
      });
      toast.success("Review saved. No model training was triggered.");
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      {error && <ErrorNotice message={error} />}
      {loading ? (
        <Skeleton />
      ) : !data?.length ? (
        <section className="card">
          <Empty
            title="Nothing needs a second look"
            description="Predictions marked incorrect appear here with their original image and feedback."
          />
        </section>
      ) : (
        <div className="report-list">
          {data.map((p) => (
            <section className="card report-card" key={p.id}>
              <Link to={`/history/${p.id}`} className="report-image">
                <SecureImage path={p.image_url} alt={p.original_filename} />
              </Link>
              <div className="report-body">
                <div className="report-heading">
                  <div>
                    <h3>{p.original_filename}</h3>
                    <p>
                      {p.user_name} · {date(p.created_at)}{" "}
                      {p.is_demo_data && <Badge tone="amber">Demo</Badge>}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/history/${p.id}`}>
                      Inspect prediction <ArrowUpRight size={15} />
                    </Link>
                  </Button>
                </div>
                <div className="report-detections">
                  {p.detections.map((d) => (
                    <Badge key={d.id}>
                      {d.class_name} {percent(d.confidence)}
                    </Badge>
                  ))}
                </div>
                <small className="muted">{p.model_version}</small>
                {p.feedback
                  .filter((f) => !f.is_correct)
                  .map((f) => (
                    <div className="review-item" key={f.id}>
                      <div>
                        <strong>{f.reason || "Incorrect prediction"}</strong>
                        <Badge
                          tone={
                            f.review_status === "pending" ? "amber" : "green"
                          }
                        >
                          {f.review_status.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <p>{f.comment || "No additional comment."}</p>
                      {f.reviewed_at && (
                        <small>
                          Reviewed {date(f.reviewed_at)} ·{" "}
                          {f.review_note || "No reviewer note"}
                        </small>
                      )}
                      <label htmlFor={`note-${f.id}`}>Review note</label>
                      <input
                        id={`note-${f.id}`}
                        value={notes[f.id] || ""}
                        maxLength={2000}
                        onChange={(e) =>
                          setNotes({ ...notes, [f.id]: e.target.value })
                        }
                        placeholder="Add context for future dataset curation…"
                      />
                      <div className="inline-actions">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy === f.id}
                          onClick={() => void review(f.id, "reviewed")}
                        >
                          {busy === f.id ? (
                            <Loader2 size={14} className="spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          Mark reviewed
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy === f.id}
                          onClick={() => void review(f.id, "dataset_candidate")}
                        >
                          Dataset candidate
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === f.id}
                          onClick={() => void review(f.id, "dismissed")}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <p className="footnote">
        <ShieldCheck size={15} />
        Dataset candidates still require consent checks, corrected labels, and
        evaluation before future training. Reviewing a report never changes the
        running model.
      </p>
    </>
  );
}
function UserList() {
  const { data, loading, error } =
    useResource<
      (User & {
        created_at: string;
        last_active_at: string;
        predictions: number;
      })[]
    >("/api/admin/users");
  return (
    <section className="card">
      <CardTitle
        title="Workspace users"
        subtitle="Read-only visibility · latest 200 users, including guest sessions"
      />
      {error && <ErrorNotice message={error} />}
      {loading ? (
        <Skeleton />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Predictions</th>
                <th>Joined</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    <small>
                      {u.email || `Guest session ${u.id.slice(0, 8)}`}
                    </small>
                  </td>
                  <td>
                    <Badge tone={u.role === "ADMIN" ? "green" : ""}>
                      {u.role.toLowerCase()}
                    </Badge>
                  </td>
                  <td>{u.predictions}</td>
                  <td>{date(u.created_at)}</td>
                  <td>{date(u.last_active_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function ProductFeedback() {
  const { data, loading, error } = useResource<
    {
      id: number;
      user_name: string;
      created_at: string;
      category: string;
      rating: number;
      message: string;
      prediction_id: string | null;
    }[]
  >("/api/admin/feedback");
  return (
    <section className="card">
      <CardTitle
        title="Product feedback"
        subtitle="Messages from employees and administrators · latest 200"
      />
      {error && <ErrorNotice message={error} />}
      {loading ? (
        <Skeleton />
      ) : !data?.length ? (
        <Empty
          title="Room for your users’ perspective"
          description="Product feedback appears here when someone submits the feedback form."
        />
      ) : (
        <div className="product-feedback-list">
          {data.map((f) => (
            <article key={f.id}>
              <div>
                <Badge>{f.category}</Badge>
                <span className="rating-stars">
                  {"★".repeat(f.rating)}
                  {"☆".repeat(5 - f.rating)}
                </span>
              </div>
              <p>{f.message}</p>
              <footer>
                <span>
                  {f.user_name} · {date(f.created_at)}
                </span>
                {f.prediction_id && (
                  <Link to={`/history/${f.prediction_id}`}>
                    Open prediction <ArrowUpRight size={14} />
                  </Link>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
export function Admin() {
  const [tab, setTab] = useState("Overview");
  const {
    data: s,
    loading,
    error,
    refresh,
  } = useResource<SystemInfo>("/api/admin/system", 10000);
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE MANAGEMENT"
        title="Keep the whole system in view."
        description="Review feedback, understand usage, and keep your vision workspace healthy."
        actions={
          <Badge tone="green">
            <ShieldCheck size={14} />
            Administrator
          </Badge>
        }
      />
      <div
        className="page-tabs"
        role="tablist"
        aria-label="Administration sections"
      >
        {[
          "Overview",
          "Users",
          "Reported predictions",
          "Feedback",
          "System",
        ].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t}
            {t === "Reported predictions" && !!s?.incorrect_reports && (
              <span>{s.incorrect_reports}</span>
            )}
          </button>
        ))}
      </div>
      {error && <ErrorNotice message={error} retry={() => void refresh()} />}
      {tab === "Users" ? (
        <UserList />
      ) : tab === "Reported predictions" ? (
        <Reported />
      ) : tab === "Feedback" ? (
        <ProductFeedback />
      ) : loading ? (
        <Skeleton />
      ) : (
        s && (
          <>
            {tab === "Overview" && (
              <>
                <div className="metrics-grid four">
                  <Metric
                    label="Total users"
                    value={s.total_users}
                    note={`${s.recent_users} active in the last 24h, including guests`}
                    icon={<Users size={16} />}
                  />
                  <Metric
                    label="Total predictions"
                    value={s.total_predictions}
                    note={`${s.predictions_today} today · includes demo records`}
                  />
                  <Metric
                    label="Incorrect reports"
                    value={s.incorrect_reports}
                    note="Human review judgments"
                  />
                  <Metric
                    label="Product feedback"
                    value={s.feedback_count}
                    note="Messages from your workspace"
                  />
                </div>
                <div className="two-column">
                  <section className="card admin-action-card">
                    <span className="empty-icon">
                      <ShieldCheck size={27} />
                    </span>
                    <h2>A human in the loop.</h2>
                    <p>
                      Keep the original image, detections, model version, and
                      user feedback together. Review reports before considering
                      them for a future dataset.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setTab("Reported predictions")}
                    >
                      Review reported predictions <ArrowUpRight size={16} />
                    </Button>
                  </section>
                  <section className="card">
                    <CardTitle
                      title="Live service · last 24 hours"
                      subtitle="Demo records excluded"
                    />
                    <div className="admin-latencies">
                      <div>
                        <span>P50 processing</span>
                        <strong>{ms(s.metrics.p50_latency_ms)}</strong>
                      </div>
                      <div>
                        <span>P95 processing</span>
                        <strong>{ms(s.metrics.p95_latency_ms)}</strong>
                      </div>
                      <div>
                        <span>Error rate</span>
                        <strong>{percent(s.metrics.error_rate)}</strong>
                      </div>
                      <div>
                        <span>Requests / minute</span>
                        <strong>{s.metrics.requests_per_minute}</strong>
                      </div>
                    </div>
                  </section>
                </div>
              </>
            )}
            <section className="card system-card">
              <CardTitle
                title="System health"
                subtitle="Refreshed every 10 seconds"
              >
                <Badge tone={s.status === "healthy" ? "green" : "amber"}>
                  {s.status}
                </Badge>
              </CardTitle>
              <div className="system-grid">
                {[
                  ["API", s.api],
                  ["YOLO11n", s.model],
                  ["Database", s.database],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span
                      className={`status-dot ${value === "unavailable" ? "warning" : ""}`}
                    />
                    <strong>{label}</strong>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
              <div className="system-properties">
                <div>
                  <span>
                    <Clock3 size={15} />
                    Application uptime
                  </span>
                  <strong>
                    {Math.floor(s.uptime_seconds / 60)}m {s.uptime_seconds % 60}
                    s
                  </strong>
                </div>
                <div>
                  <span>Model version</span>
                  <code>{s.model_info.version}</code>
                </div>
                <div>
                  <span>Model device</span>
                  <strong>{s.model_info.device}</strong>
                </div>
                <div>
                  <span>Prometheus endpoint</span>
                  <code>/metrics · admin or scraper bearer token</code>
                </div>
                <div>
                  <span>Storage</span>
                  <strong>Local filesystem · configurable database</strong>
                </div>
              </div>
            </section>
          </>
        )
      )}
    </>
  );
}
