import type { ReactNode } from "react";
import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Info,
  RefreshCw,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { useResource } from "../hooks/useResource";
import type { Analytics as AnalyticsData, Health } from "../services/types";
import {
  Badge,
  CardTitle,
  Empty,
  ErrorNotice,
  Metric,
  PageHeading,
  Skeleton,
} from "../components/Common";
import { Button } from "../components/ui/button";
import { percent, ms } from "../services/utils";
import { PredictionTable } from "./History";

const tick = { fill: "var(--muted)", fontSize: 11 };
const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 12,
};
function ChartCard({
  title,
  subtitle,
  children,
  badge,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <section className="card chart-card">
      <CardTitle title={title} subtitle={subtitle}>
        {badge}
      </CardTitle>
      <div className="chart-body">{children}</div>
    </section>
  );
}

export function Analytics() {
  const [window, setWindow] = useState("7d");
  const [source, setSource] = useState("all");
  const {
    data: a,
    loading,
    error,
    refresh,
  } = useResource<AnalyticsData>(
    `/api/analytics/overview?window=${window}&data=${source}`,
    10000,
  );
  const { data: health, error: healthError } = useResource<Health>(
    "/api/health",
    10000,
  );
  const timeLabel = (value: number) =>
    new Date(value).toLocaleString(
      [],
      window === "1h" || window === "24h"
        ? { hour: "2-digit", minute: "2-digit" }
        : { month: "short", day: "numeric" },
    );
  return (
    <>
      <PageHeading
        eyebrow="SERVICE OBSERVABILITY"
        title="The bigger picture."
        description="Understand how your vision service behaves, one request at a time."
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh analytics"
              onClick={() => void refresh()}
            >
              <RefreshCw size={16} />
            </Button>
            <select
              aria-label="Analytics data source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="all">All data</option>
              <option value="live">Live only</option>
              <option value="demo">Demo only</option>
            </select>
            <select
              aria-label="Time range"
              value={window}
              onChange={(e) => setWindow(e.target.value)}
            >
              <option value="1h">Last hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </>
        }
      />
      <div className="observability-context">
        <div>
          <span className={`status-dot ${error ? "warning" : ""}`} />
          <strong>
            {error ? "Refresh unavailable" : "Auto-refresh every 10s"}
          </strong>
          <span className="context-divider" />
          <span>
            {a?.scope === "system"
              ? "Workspace-wide activity"
              : "Your personal activity"}
          </span>
        </div>
        <span>
          {a?.demo_count
            ? `${a.live_count} live · ${a.demo_count} demo records`
            : "Live application data"}
          {a && (
            <small>
              {" "}
              · Updated {new Date(a.updated_at).toLocaleTimeString()}
            </small>
          )}
        </span>
      </div>
      {error && (
        <ErrorNotice
          message={`${error}${a ? " Showing the last available snapshot." : ""}`}
          retry={() => void refresh()}
        />
      )}
      {loading && !a ? (
        <Skeleton count={6} />
      ) : (
        a && (
          <>
            <div className="metrics-grid six">
              <Metric
                label="Total requests"
                value={a.total_requests.toLocaleString()}
                note="Persisted prediction attempts"
                icon={<Activity size={16} />}
              />
              <Metric
                label="Successful predictions"
                value={a.successful_predictions.toLocaleString()}
                note="Completed inference requests"
                icon={<CheckCircle2 size={16} />}
              />
              <Metric
                label="P50 latency"
                value={ms(a.p50_latency_ms)}
                note="Median server processing"
                icon={<Clock3 size={16} />}
              />
              <Metric
                label="P95 latency"
                value={ms(a.p95_latency_ms)}
                note="95th percentile processing"
                icon={<Clock3 size={16} />}
              />
              <Metric
                label="Average confidence"
                value={percent(a.average_confidence)}
                note="Across individual detections"
              />
              <Metric
                label="Error rate"
                value={percent(a.error_rate)}
                note="Failed prediction attempts"
              />
            </div>
            {!a.total_requests && (
              <Empty
                title="Your observability story starts here"
                description="Analyze an image to see real request volumes, latency, and detection metrics."
                action={
                  <Button asChild>
                    <Link to="/analyze">
                      Analyze an image <ArrowUpRight size={16} />
                    </Link>
                  </Button>
                }
              />
            )}
            <div className="charts-grid">
              <ChartCard
                title="Request volume"
                subtitle="Prediction attempts over time"
                badge={
                  <Badge>
                    <span className="legend-dot green-dot" />
                    Requests
                  </Badge>
                }
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={a.timeseries}
                    margin={{ top: 8, right: 10, left: -22, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="request-fill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#438d6d"
                          stopOpacity={0.22}
                        />
                        <stop
                          offset="100%"
                          stopColor="#438d6d"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--border)"
                      vertical={false}
                      strokeDasharray="3 4"
                    />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={timeLabel}
                      tick={tick}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={35}
                    />
                    <YAxis
                      tick={tick}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(v) => timeLabel(Number(v))}
                    />
                    <Area
                      type="monotone"
                      dataKey="requests"
                      stroke="#438d6d"
                      strokeWidth={2.5}
                      fill="url(#request-fill)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard
                title="Latency over time"
                subtitle="Server processing · milliseconds"
                badge={
                  <div className="chart-legend">
                    <span>
                      <i className="legend-dot green-dot" />
                      P50
                    </span>
                    <span>
                      <i className="legend-dot purple-dot" />
                      P95
                    </span>
                  </div>
                }
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={a.timeseries}
                    margin={{ top: 8, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="var(--border)"
                      vertical={false}
                      strokeDasharray="3 4"
                    />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={timeLabel}
                      tick={tick}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={35}
                    />
                    <YAxis tick={tick} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(v) => timeLabel(Number(v))}
                    />
                    <Line
                      type="monotone"
                      dataKey="p50"
                      stroke="#438d6d"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="p95"
                      stroke="#a491bc"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      dot={{ r: 2 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard
                title="Top detected classes"
                subtitle="Objects recognized across your images"
              >
                {a.classes.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={a.classes.slice(0, 6)}
                      layout="vertical"
                      margin={{ left: 5, right: 25 }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        horizontal={false}
                        strokeDasharray="3 4"
                      />
                      <XAxis
                        type="number"
                        tick={tick}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={76}
                        tick={tick}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        cursor={{ fill: "var(--surface-alt)" }}
                      />
                      <Bar
                        dataKey="count"
                        radius={[0, 4, 4, 0]}
                        barSize={18}
                        isAnimationActive={false}
                      >
                        {a.classes.slice(0, 6).map((c, i) => (
                          <Cell
                            key={c.name}
                            fill={
                              [
                                "#438d6d",
                                "#64a384",
                                "#85b59e",
                                "#a6c7b7",
                                "#789c87",
                                "#527e69",
                              ][i]
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty
                    title="No classes yet"
                    description="Detected object classes will appear here."
                  />
                )}
              </ChartCard>
              <ChartCard
                title="Confidence distribution"
                subtitle="Model confidence per detected object"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={a.confidence_distribution}
                    margin={{ left: -23, right: 8 }}
                  >
                    <CartesianGrid
                      stroke="var(--border)"
                      vertical={false}
                      strokeDasharray="3 4"
                    />
                    <XAxis
                      dataKey="range"
                      tick={{ ...tick, fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      interval={1}
                    />
                    <YAxis
                      tick={tick}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: "var(--surface-alt)" }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#8fa998"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <div className="three-column">
              <section className="card compact-chart">
                <CardTitle
                  title="Request outcomes"
                  subtitle="Success and error distribution"
                />
                <div className="outcome-number">
                  {percent(
                    a.total_requests
                      ? a.successful_predictions / a.total_requests
                      : null,
                  )}
                  <span>successful</span>
                </div>
                <div className="outcome-bar">
                  <span
                    style={{
                      width: `${a.total_requests ? (a.successful_predictions / a.total_requests) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="outcome-labels">
                  <span>
                    <i className="legend-dot green-dot" />
                    Success <b>{a.successful_predictions}</b>
                  </span>
                  <span>
                    <i className="legend-dot red-dot" />
                    Error <b>{a.total_requests - a.successful_predictions}</b>
                  </span>
                </div>
              </section>
              <section className="card compact-chart">
                <CardTitle
                  title="Usage by role"
                  subtitle={
                    a.scope === "system"
                      ? "Across the workspace"
                      : "Within your permitted data"
                  }
                />
                <div className="role-bars">
                  {a.roles.map((r) => (
                    <div key={r.name}>
                      <span>{r.name.toLowerCase()}</span>
                      <div>
                        <i
                          style={{
                            width: `${a.total_requests ? (r.count / a.total_requests) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <b>{r.count}</b>
                    </div>
                  ))}
                </div>
              </section>
              <section className="card compact-chart">
                <CardTitle
                  title="System status"
                  subtitle="Live service availability"
                />
                <div className="health-list">
                  {[
                    ["API", health?.api],
                    ["YOLO11n", health?.model],
                    ["Database", health?.database],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <span>
                        <i
                          className={`status-dot ${healthError || !value || value === "unavailable" ? "warning" : ""}`}
                        />
                        {healthError ? "Unavailable" : value || "Checking"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="status-caption">
                  {a.requests_per_minute} requests in the last minute ·{" "}
                  {a.scope} scope
                </div>
              </section>
            </div>
            <section className="card">
              <CardTitle
                title="Recent requests"
                subtitle="The latest activity in this view"
              >
                <Link className="text-link" to="/history">
                  View history <ArrowUpRight size={15} />
                </Link>
              </CardTitle>
              {a.recent.length ? (
                <PredictionTable items={a.recent} />
              ) : (
                <Empty
                  title="No recent requests"
                  description="Your next analysis will appear here."
                />
              )}
            </section>
            <p className="footnote">
              <Info size={14} />
              Operational metrics come from stored prediction attempts.
              Confidence is not accuracy; validation rejects before route
              execution appear only in HTTP telemetry. Demo records are
              explicitly labeled and can be excluded.
            </p>
          </>
        )
      )}
    </>
  );
}
