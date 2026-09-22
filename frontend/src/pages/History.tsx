import { useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowRight,
  History as HistoryIcon,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { Prediction } from "../services/types";
import { useResource } from "../hooks/useResource";
import { useAuth } from "../hooks/useAuth";
import {
  Badge,
  Empty,
  ErrorNotice,
  PageHeading,
  SecureImage,
  Skeleton,
} from "../components/Common";
import { Button } from "../components/ui/button";
import { date, ms, percent } from "../services/utils";
import { PredictionView } from "../components/PredictionView";

export function PredictionTable({ items }: { items: Prediction[] }) {
  return (
    <div className="table-scroll">
      <table className="predictions-table">
        <thead>
          <tr>
            <th>Prediction</th>
            <th>Detected objects</th>
            <th>Confidence</th>
            <th>Latency</th>
            <th>Status</th>
            <th>Feedback</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>
                <Link className="prediction-cell" to={`/history/${p.id}`}>
                  <SecureImage
                    path={p.image_url}
                    alt={p.original_filename}
                    className="thumbnail"
                  />
                  <div>
                    <strong className="mono">{p.id.slice(0, 8)}</strong>
                    <span>{date(p.created_at)}</span>
                    <span>
                      {p.user_name} · {p.role.toLowerCase()}
                    </span>
                  </div>
                </Link>
              </td>
              <td>
                <span className="detected-names">
                  {p.detections.length
                    ? [...new Set(p.detections.map((d) => d.class_name))].join(
                        ", ",
                      )
                    : "No detections"}
                </span>
                <small>
                  {p.number_of_detections} objects{" "}
                  {p.is_demo_data && (
                    <span className="demo-inline">· DEMO</span>
                  )}
                </small>
              </td>
              <td className="mono">
                {p.number_of_detections ? percent(p.average_confidence) : "—"}
              </td>
              <td className="mono">{ms(p.total_latency_ms)}</td>
              <td>
                <Badge tone={p.status === "success" ? "green" : "red"}>
                  {p.status === "success" ? "Completed" : "Failed"}
                </Badge>
              </td>
              <td>
                {p.feedback.length ? (
                  <Badge
                    tone={p.feedback.some((f) => !f.is_correct) ? "amber" : ""}
                  >
                    {p.feedback.some((f) => !f.is_correct)
                      ? "Reported"
                      : "Correct"}
                  </Badge>
                ) : (
                  <span className="muted">Unreviewed</span>
                )}
              </td>
              <td>
                <Link
                  to={`/history/${p.id}`}
                  aria-label={`Open prediction ${p.id.slice(0, 8)}`}
                  className="table-arrow"
                >
                  <ArrowRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function History() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [feedback, setFeedback] = useState("all");
  const [data, setData] = useState("all");
  const [sort, setSort] = useState("newest");
  const [after, setAfter] = useState("");
  const [before, setBefore] = useState("");
  const [confidence, setConfidence] = useState("0");
  const [maxConfidence, setMaxConfidence] = useState("1");
  const [className, setClassName] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(false);
  const params = new URLSearchParams({
    search,
    status,
    feedback,
    data,
    sort,
    min_confidence: confidence,
    max_confidence: maxConfidence,
    class_name: className,
    page: String(page),
  });
  if (after) params.set("after", `${after}T00:00:00Z`);
  if (before) params.set("before", `${before}T23:59:59Z`);
  const {
    data: result,
    loading,
    error,
    refresh,
  } = useResource<{ items: Prediction[]; total: number }>(
    `/api/predictions?${params}`,
  );
  const change = (setter: (s: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };
  return (
    <>
      <PageHeading
        eyebrow="PREDICTION ARCHIVE"
        title="Every image. A little more insight."
        description={
          user?.role === "ADMIN"
            ? "Explore and review predictions across your workspace."
            : "Revisit your predictions, explore details, and close the feedback loop."
        }
        actions={
          <Button asChild>
            <Link to="/analyze">
              New analysis <ArrowRight size={16} />
            </Link>
          </Button>
        }
      />
      <section className="card history-card">
        <div className="history-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search predictions"
              placeholder="Search ID, filename, or object…"
              value={search}
              onChange={(e) => change(setSearch, e.target.value)}
            />
          </div>
          <div className="inline-actions">
            <select
              aria-label="Data source"
              value={data}
              onChange={(e) => change(setData, e.target.value)}
            >
              <option value="all">All data</option>
              <option value="live">Live only</option>
              <option value="demo">Demo only</option>
            </select>
            <Button variant="outline" onClick={() => setFilters(!filters)}>
              <SlidersHorizontal size={16} />
              Filters
            </Button>
            <label className="sort-control">
              <ArrowDownWideNarrow size={16} />
              <select
                aria-label="Sort predictions"
                value={sort}
                onChange={(e) => change(setSort, e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="confidence">Highest confidence</option>
                <option value="latency">Highest latency</option>
              </select>
            </label>
          </div>
        </div>
        {filters && (
          <div className="filter-panel">
            <label>
              Status
              <select
                value={status}
                onChange={(e) => change(setStatus, e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="success">Completed</option>
                <option value="error">Failed</option>
              </select>
            </label>
            <label>
              Feedback
              <select
                value={feedback}
                onChange={(e) => change(setFeedback, e.target.value)}
              >
                <option value="all">All feedback</option>
                <option value="incorrect">Reported</option>
                <option value="correct">Correct</option>
                <option value="none">Unreviewed</option>
              </select>
            </label>
            <label>
              Class
              <input
                placeholder="e.g. person"
                value={className}
                onChange={(e) => change(setClassName, e.target.value)}
              />
            </label>
            <label>
              From (UTC)
              <input
                type="date"
                value={after}
                onChange={(e) => change(setAfter, e.target.value)}
              />
            </label>
            <label>
              Through (UTC)
              <input
                type="date"
                value={before}
                onChange={(e) => change(setBefore, e.target.value)}
              />
            </label>
            <label>
              Minimum confidence
              <select
                value={confidence}
                onChange={(e) => change(setConfidence, e.target.value)}
              >
                <option value="0">Any</option>
                <option value="0.5">50%</option>
                <option value="0.75">75%</option>
                <option value="0.9">90%</option>
              </select>
            </label>
            <label>
              Maximum confidence
              <select
                value={maxConfidence}
                onChange={(e) => change(setMaxConfidence, e.target.value)}
              >
                <option value="1">100%</option>
                <option value="0.9">90%</option>
                <option value="0.75">75%</option>
                <option value="0.5">50%</option>
              </select>
            </label>
          </div>
        )}
        {error ? (
          <ErrorNotice message={error} retry={() => void refresh()} />
        ) : loading ? (
          <Skeleton count={4} />
        ) : result?.items.length ? (
          <PredictionTable items={result.items} />
        ) : (
          <Empty
            title="No predictions found"
            description="Try a different filter, or analyze your first image to start your history."
            action={
              <Button variant="outline" asChild>
                <Link to="/analyze">
                  <HistoryIcon size={16} />
                  Analyze an image
                </Link>
              </Button>
            }
          />
        )}
        <div className="table-footer">
          <span>
            {result?.total || 0} predictions{" "}
            <span className="muted">
              · {user?.role === "ADMIN" ? "Workspace history" : "Your history"}
            </span>
          </span>
          <div className="inline-actions">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ArrowLeft size={15} />
              Previous
            </Button>
            <span>Page {page}</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page * 20 >= (result?.total || 0)}
              onClick={() => setPage(page + 1)}
            >
              Next
              <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
export function PredictionDetail() {
  const { id } = useParams();
  const { data, error, loading, refresh } = useResource<Prediction>(
    `/api/predictions/${id}`,
  );
  return (
    <>
      <Link className="back-link" to="/history">
        <ArrowLeft size={16} />
        Back to history
      </Link>
      <PageHeading
        eyebrow="PREDICTION DETAILS"
        title="The full picture."
        description="Original image, model output, and human feedback — in one place."
        actions={data?.is_demo_data && <Badge tone="amber">Demo record</Badge>}
      />
      {loading ? (
        <Skeleton />
      ) : error ? (
        <ErrorNotice message={error} />
      ) : (
        data && (
          <PredictionView prediction={data} onUpdate={() => void refresh()} />
        )
      )}
    </>
  );
}
