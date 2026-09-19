"""Input and output contracts.

`normalize` reproduces the validation rules of `shared/engine.js` (metric
known, timestamp carries a timezone, positive finite value, unit matches,
non-empty source, no duplicate metric/timestamp) and emits the same record
ids and ISO format, so `sourceIds` and `recent` line up with the events the
server already stores.
"""

from datetime import datetime, timezone

from .metrics import METRICS

STATE_TO_LEGACY = {
    "monitoring": "quiet",
    "context_needed": "context",
    "review_recommended": "review",
    "insufficient_data": "context",
}
APPLICATION_STATES = tuple(STATE_TO_LEGACY)
MAX_EVENTS = 2_000_000  # the JS engine caps at 10,000; the CLI is more permissive


class ContractError(ValueError):
    pass


def parse_timestamp(value):
    if not isinstance(value, str):
        raise ContractError("timestamp must be a string with timezone")
    if not (value.endswith("Z") or (len(value) >= 6 and value[-6] in "+-" and value[-3] == ":")):
        raise ContractError("timestamp must include timezone")
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ContractError("timestamp is not ISO 8601") from exc
    if dt.tzinfo is None:
        raise ContractError("timestamp must include timezone")
    return dt.astimezone(timezone.utc)


def to_iso(dt):
    """JS `Date.toISOString()` format: millisecond precision, trailing Z."""
    dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def epoch_ms(dt):
    return int(round(dt.timestamp() * 1000))


def from_epoch_ms(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)


def normalize(events):
    if not isinstance(events, list) or not events or len(events) > MAX_EVENTS:
        raise ContractError(f"Supply 1-{MAX_EVENTS:,} measurement records.")
    seen = set()
    out = []
    for i, e in enumerate(events):
        n = i + 1
        if not isinstance(e, dict) or e.get("metric") not in METRICS:
            raise ContractError(f"Record {n}: unsupported metric.")
        m = METRICS[e["metric"]]
        try:
            dt = parse_timestamp(e.get("timestamp"))
        except ContractError as exc:
            raise ContractError(f"Record {n}: {exc}") from None
        v = e.get("value")
        if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v or v in (float("inf"), float("-inf")):
            raise ContractError(f"Record {n}: invalid measurement.")
        if not (m.lo < v <= m.hi):
            raise ContractError(f"Record {n}: invalid measurement.")
        if e.get("unit") != m.unit:
            raise ContractError(f"Record {n}: expected unit {m.unit}.")
        src = e.get("source")
        if not isinstance(src, str) or not src.strip() or len(src) > 100:
            raise ContractError(f"Record {n}: source is required (maximum 100 characters).")
        ms = epoch_ms(dt)
        key = (m.key, ms)
        if key in seen:
            raise ContractError(f"Record {n}: duplicate metric/timestamp.")
        seen.add(key)
        out.append(
            {
                "id": f"obs-{m.key}-{ms}",
                "metric": m.key,
                "timestamp": to_iso(dt),
                "value": float(v),
                "unit": m.unit,
                "source": src.strip(),
                "_ms": ms,
            }
        )
    out.sort(key=lambda r: r["_ms"])
    return out


def public_event(e):
    return {k: v for k, v in e.items() if not k.startswith("_")}


def normalize_context(context):
    """Structured check-in answers. Only enumerated or boolean fields survive."""
    if context in (None, {}, []):
        return None
    if not isinstance(context, dict):
        raise ContractError("context must be an object")
    clean = {}
    for k, v in context.items():
        if not isinstance(k, str) or len(k) > 60:
            continue
        if isinstance(v, bool) or v is None:
            clean[k] = v
        elif isinstance(v, (int, float)) and k in ("temperature_c",):
            clean[k] = float(v)
        elif isinstance(v, str) and len(v) <= 60:
            clean[k] = v
        # anything else (free text, nested objects) is dropped on purpose
    return clean or None
