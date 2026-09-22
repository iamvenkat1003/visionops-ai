"""Demo-scale aggregation over database samples, with explicit scope and provenance."""

from collections import Counter, defaultdict
from datetime import timedelta, timezone
from math import floor

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.models.entities import Prediction, utcnow
from app.services.predictions import serialize


def percentile(values, q):
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * q
    lower = floor(position)
    upper = min(lower + 1, len(ordered) - 1)
    return round(ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower), 2)


def calculate(db, user, window="7d", data="all"):
    now = utcnow()
    delta = {
        "1h": timedelta(hours=1),
        "24h": timedelta(days=1),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    query = select(Prediction).options(joinedload(Prediction.user))
    if user.role != "ADMIN":
        query = query.where(Prediction.user_id == user.id)
    if window in delta:
        query = query.where(Prediction.created_at >= now - delta[window])
    if data != "all":
        query = query.where(Prediction.is_demo_data == (data == "demo"))
    rows = db.scalars(query.order_by(Prediction.created_at)).all()
    good = [p for p in rows if p.status == "success"]
    latencies = [p.total_latency_ms for p in good]
    confidences = [d.confidence for p in good for d in p.detections]
    classes = Counter(d.class_name for p in good for d in p.detections)
    roles = Counter(p.user.role for p in rows)
    bins = [0] * 10
    for value in confidences:
        bins[min(int(value * 10), 9)] += 1
    buckets = defaultdict(list)
    bucket_seconds = 300 if window == "1h" else 3600 if window == "24h" else 86400
    for p in rows:
        moment = p.created_at.replace(tzinfo=timezone.utc)
        key = int(moment.timestamp()) // bucket_seconds * bucket_seconds
        buckets[key].append(p)
    start = (
        now - delta[window]
        if window in delta
        else (rows[0].created_at.replace(tzinfo=timezone.utc) if rows else now - timedelta(days=6))
    )
    first_bucket = int(start.timestamp()) // bucket_seconds * bucket_seconds
    last_bucket = int(now.timestamp()) // bucket_seconds * bucket_seconds
    # Limit only empty all-time buckets; actual samples and percentiles are never sampled.
    if (last_bucket - first_bucket) / bucket_seconds > 365:
        bucket_seconds = 86400 * 30
        buckets.clear()
        for p in rows:
            key = (
                int(p.created_at.replace(tzinfo=timezone.utc).timestamp()) // bucket_seconds * bucket_seconds
            )
            buckets[key].append(p)
        first_bucket = int(start.timestamp()) // bucket_seconds * bucket_seconds
        last_bucket = int(now.timestamp()) // bucket_seconds * bucket_seconds
    series = []
    for key in range(first_bucket, last_bucket + 1, bucket_seconds):
        items = buckets[key]
        values = [p.total_latency_ms for p in items if p.status == "success"]
        series.append(
            {
                "timestamp": key * 1000,
                "requests": len(items),
                "errors": sum(p.status != "success" for p in items),
                "p50": percentile(values, 0.5),
                "p95": percentile(values, 0.95),
            }
        )
    return {
        "scope": "system" if user.role == "ADMIN" else "personal",
        "window": window,
        "data": data,
        "total_requests": len(rows),
        "successful_predictions": len(good),
        "p50_latency_ms": percentile(latencies, 0.5),
        "p95_latency_ms": percentile(latencies, 0.95),
        "average_confidence": sum(confidences) / len(confidences) if confidences else None,
        "error_rate": (len(rows) - len(good)) / len(rows) if rows else 0,
        "demo_count": sum(p.is_demo_data for p in rows),
        "live_count": sum(not p.is_demo_data for p in rows),
        "requests_per_minute": sum(
            p.created_at.replace(tzinfo=timezone.utc) >= now - timedelta(minutes=1) for p in rows
        ),
        "timeseries": series,
        "classes": [{"name": name, "count": count} for name, count in classes.most_common(10)],
        "confidence_distribution": [
            {"range": f"{i * 10}–{(i + 1) * 10}%", "count": v} for i, v in enumerate(bins)
        ],
        "roles": [{"name": name, "count": roles[name]} for name in ["GUEST", "EMPLOYEE", "ADMIN"]],
        "recent": [serialize(p) for p in reversed(rows[-8:])],
        "updated_at": now.isoformat(),
    }
