"""Six-hour windows with cadence-aware staleness.

Real wearables report some metrics roughly once a day, so a six-hour grid is
mostly empty for them. Each window therefore carries two views of a metric:

* `observed`: the mean of samples that fall inside the window itself.
  Baselines are built from these. Every event value is a level (a reading),
  never an increment, so cumulative quantities such as steps must already be
  totals per reading when they enter the contract.
* `filled`: `observed` when the window has samples, otherwise the mean of
  samples in a trailing lookback of max(24h, 2 x that metric's own cadence)
  ending at the window end (a reading from the last day is current), plus the age of the newest sample. Deviations are
  computed from these, and a window whose newest sample is older than the
  lookback is *stale*, never "normal".
"""

import bisect
import math
from dataclasses import dataclass

import numpy as np

HOUR_MS = 3_600_000
WINDOW_MS = 6 * HOUR_MS
MAX_GAP_HOURS = 48  # gaps longer than this do not inform cadence (engine parity)
MIN_LOOKBACK_HOURS = 24.0


@dataclass
class MetricSeries:
    metric: str
    times_ms: np.ndarray  # sorted observation times
    values: np.ndarray
    ids: list
    cadence_hours: float
    lookback_hours: float
    observed: np.ndarray  # per window aggregate or nan
    observed_count: np.ndarray
    filled: np.ndarray  # trailing-lookback aggregate or nan
    age_hours: np.ndarray  # hours since newest sample at window end (inf if none)

    @property
    def fresh(self):
        return self.age_hours <= self.lookback_hours


@dataclass
class WindowGrid:
    ends_ms: np.ndarray  # window end times, ascending; last == analyzed_through
    series: dict  # metric -> MetricSeries
    cadence_hours: float  # pooled cadence (engine parity)
    window_hours: float  # recent window length: max(36, 3 x cadence)
    analyzed_through_ms: int

    @property
    def starts_ms(self):
        return self.ends_ms - WINDOW_MS

    def recent_mask(self):
        return self.ends_ms >= self.analyzed_through_ms - int(self.window_hours * HOUR_MS)

    def history_mask(self):
        return ~self.recent_mask()


def _gaps_hours(times_ms):
    if len(times_ms) < 2:
        return np.array([])
    g = np.diff(times_ms) / HOUR_MS
    return g[(g > 0) & (g <= MAX_GAP_HOURS)]


def _median_or(values, default):
    return float(np.median(values)) if len(values) else default


def build_grid(events, analyzed_through_ms=None, max_windows=20_000, core_metrics=None):
    """`events` are normalized records (with `_ms`).

    The recent-window length follows the cadence of `core_metrics` (median of
    each core metric's own median gap), so four-a-day step counts cannot
    shrink the window below what a once-a-day gait or resting-heart-rate
    reading needs. Without `core_metrics` every metric present counts."""
    if not events:
        raise ValueError("no events")
    last_ms = max(e["_ms"] for e in events)
    first_ms = min(e["_ms"] for e in events)
    if analyzed_through_ms is None:
        analyzed_through_ms = last_ms
    end = int(analyzed_through_ms)
    n = int(math.ceil((end - first_ms) / WINDOW_MS)) + 1
    n = max(1, min(n, max_windows))
    ends = end - np.arange(n - 1, -1, -1, dtype=np.int64) * WINDOW_MS

    by_metric = {}
    for e in events:
        by_metric.setdefault(e["metric"], []).append(e)

    series = {}
    for metric, evs in by_metric.items():
        evs.sort(key=lambda r: r["_ms"])
        t = np.array([r["_ms"] for r in evs], dtype=np.int64)
        v = np.array([r["value"] for r in evs], dtype=float)
        gaps = _gaps_hours(t)
        cadence = _median_or(gaps, 6.0) if len(gaps) else 6.0
        lookback = max(MIN_LOOKBACK_HOURS, 2.0 * cadence)
        series[metric] = _aggregate(metric, t, v, [r["id"] for r in evs], ends, cadence, lookback)
    core = [m for m in (core_metrics or []) if m in series] or list(series)
    pooled_cadence = _median_or(np.array([series[m].cadence_hours for m in core]), 6.0)
    window_hours = max(36.0, math.ceil(3.0 * pooled_cadence / 6.0) * 6.0)  # whole six-hour blocks
    return WindowGrid(ends, series, pooled_cadence, window_hours, end)


def _aggregate(metric, t, v, ids, ends, cadence, lookback):
    starts = ends - WINDOW_MS
    csum = np.concatenate([[0.0], np.cumsum(v)])
    # indices of samples in (start, end]
    lo = np.searchsorted(t, starts, side="right")
    hi = np.searchsorted(t, ends, side="right")
    cnt = hi - lo
    total = csum[hi] - csum[lo]
    with np.errstate(invalid="ignore", divide="ignore"):
        observed = np.where(cnt > 0, total / np.maximum(cnt, 1), np.nan)
    # trailing lookback (end - lookback, end]
    lb_ms = int(lookback * HOUR_MS)
    lo2 = np.searchsorted(t, ends - lb_ms, side="right")
    cnt2 = hi - lo2
    total2 = csum[hi] - csum[lo2]
    with np.errstate(invalid="ignore", divide="ignore"):
        lookback_mean = np.where(cnt2 > 0, total2 / np.maximum(cnt2, 1), np.nan)
    filled = np.where(cnt > 0, observed, lookback_mean)
    newest_idx = hi - 1
    age = np.where(hi > 0, (ends - t[np.clip(newest_idx, 0, len(t) - 1)]) / HOUR_MS, np.inf)
    return MetricSeries(metric, t, v, ids, cadence, lookback, observed, cnt, filled, age)


def events_in_range(series, start_ms, end_ms):
    """Indices of observations with start_ms < t <= end_ms."""
    lo = bisect.bisect_right(series.times_ms.tolist(), start_ms)
    hi = bisect.bisect_right(series.times_ms.tolist(), end_ms)
    return list(range(lo, hi))
