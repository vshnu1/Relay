"""Personalized median/MAD baselines and robust deviations.

For every window and metric the baseline is the median and scaled MAD of the
*observed* window aggregates in a trailing period that ends one recent-window
length before the window under test, so a deviation never inflates the
baseline it is measured against and the recent period never leaks into its
own baseline. A baseline is `sufficient` only with enough observed windows
spanning enough time; otherwise the deviation is missing, not zero. This is
also what keeps a newly introduced device from looking like physiology: it
has no baseline until it has history.
"""

from dataclasses import dataclass

import numpy as np

from .metrics import METRICS
from .windows import HOUR_MS

MAD_SCALE = 1.4826


@dataclass
class BaselineTrack:
    metric: str
    median: np.ndarray  # per window, nan when insufficient
    scale: np.ndarray  # robust scale used for the deviation
    mean: np.ndarray
    sd: np.ndarray
    count: np.ndarray
    span_hours: np.ndarray
    sufficient: np.ndarray  # bool per window
    start_idx: np.ndarray  # first observed window index in the baseline, -1 if none
    end_idx: np.ndarray


def robust_scale_floor(metric, median):
    """Scaled MAD is floored at one third of the metric's legacy percent
    threshold, so near-constant synthetic histories do not turn ordinary
    fluctuation into large deviations. Demo configuration, not clinical."""
    pct = METRICS[metric].threshold / 3.0 / 100.0
    return max(abs(float(median)) * pct, 1e-6)


def rolling_baseline(series, grid, program):
    """Compute per-window baselines for one MetricSeries."""
    ends = grid.ends_ms
    n = len(ends)
    obs = series.observed
    observed_idx = np.flatnonzero(~np.isnan(obs))
    obs_ends = ends[observed_idx]
    gap_ms = int(grid.window_hours * HOUR_MS)
    span_ms = int(program.baseline_days * 24 * HOUR_MS)

    median = np.full(n, np.nan)
    scale = np.full(n, np.nan)
    mean = np.full(n, np.nan)
    sd = np.full(n, np.nan)
    count = np.zeros(n, dtype=int)
    span_h = np.zeros(n)
    sufficient = np.zeros(n, dtype=bool)
    start_idx = np.full(n, -1, dtype=int)
    end_idx = np.full(n, -1, dtype=int)
    if len(observed_idx) == 0:
        return BaselineTrack(series.metric, median, scale, mean, sd, count, span_h, sufficient, start_idx, end_idx)

    for i in range(n):
        cutoff = ends[i] - gap_ms  # baseline windows must end at or before this
        hi = np.searchsorted(obs_ends, cutoff, side="right")
        lo = np.searchsorted(obs_ends, cutoff - span_ms, side="left")
        if hi - lo <= 0:
            continue
        vals = obs[observed_idx[lo:hi]]
        count[i] = len(vals)
        span_h[i] = (obs_ends[hi - 1] - obs_ends[lo]) / HOUR_MS
        med = float(np.median(vals))
        median[i] = med
        mad = float(np.median(np.abs(vals - med))) * MAD_SCALE
        scale[i] = max(mad, robust_scale_floor(series.metric, med))
        mean[i] = float(np.mean(vals))
        sd[i] = float(np.std(vals))
        start_idx[i] = observed_idx[lo]
        end_idx[i] = observed_idx[hi - 1]
        sufficient[i] = count[i] >= program.min_baseline_points and span_h[i] >= program.min_baseline_span_hours
    return BaselineTrack(series.metric, median, scale, mean, sd, count, span_h, sufficient, start_idx, end_idx)


def robust_deviation(series, track):
    """(filled value - median) / scale where the baseline is sufficient and the
    window is fresh; nan otherwise."""
    dev = (series.filled - track.median) / track.scale
    dev = np.where(track.sufficient & series.fresh, dev, np.nan)
    return dev


def percent_delta(series, track):
    with np.errstate(invalid="ignore", divide="ignore"):
        pct = (series.filled - track.median) / np.abs(track.median) * 100.0
    return np.where(track.sufficient & series.fresh & (np.abs(track.median) > 0), pct, np.nan)
