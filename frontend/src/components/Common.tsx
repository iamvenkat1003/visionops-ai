import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  ImageIcon,
  Loader2,
  ScanLine,
} from "lucide-react";
import { imageBlob } from "../services/api";
import { Button } from "./ui/button";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <ScanLine size={23} strokeWidth={1.8} />
      </span>
      {!compact && (
        <span>
          VisionOps <span className="brand-ai">AI</span>
        </span>
      )}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <ScanLine size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
      {retry && (
        <Button variant="ghost" size="sm" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <Loader2 className="spin" size={22} />
      <span>Loading your workspace…</span>
    </div>
  );
}
export function Skeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-grid" aria-label="Loading" role="status">
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton" key={i} />
      ))}
    </div>
  );
}
export function CardTitle({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="card-title">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
export function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="metric">
      <div className="metric-label">
        {label}
        {icon || <ArrowUpRight size={15} />}
      </div>
      <div className="metric-value">{value}</div>
      {note && <p>{note}</p>}
    </div>
  );
}
export function useImage(path: string | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl("");
    if (!path) return;
    const controller = new AbortController();
    let local = "";
    void imageBlob(path, controller.signal)
      .then((blob) => {
        if (!controller.signal.aborted) {
          local = URL.createObjectURL(blob);
          setUrl(local);
        }
      })
      .catch(() => {});
    return () => {
      controller.abort();
      if (local) URL.revokeObjectURL(local);
    };
  }, [path]);
  return url;
}
export function SecureImage({
  path,
  alt,
  className = "",
}: {
  path: string | null;
  alt: string;
  className?: string;
}) {
  const url = useImage(path);
  return url ? (
    <img src={url} alt={alt} className={className} />
  ) : (
    <div className={`image-placeholder ${className}`}>
      <ImageIcon size={20} />
      <span className="sr-only">Image unavailable</span>
    </div>
  );
}
