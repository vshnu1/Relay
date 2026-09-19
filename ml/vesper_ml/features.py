"""Feature matrix: robust deviations plus missingness and coverage.

One row per six-hour window. Columns are the robust deviation of every
program metric (nan when stale or without a sufficient baseline, winsorized
at +/- DEV_CLIP so one wild reading cannot dominate), followed by four
transparent summaries: the fraction of core metrics that are fresh with a
sufficient baseline, the count of fresh program metrics, the count of core
metrics beyond the program's deviation threshold, and the mean absolute
deviation across core metrics. The last two let the forest see coordination
across signals rather than only single-column extremes. Missingness
indicators are added downstream by `SimpleImputer(add_indicator=True)`.
"""

DEV_CLIP = 5.0

import warnings
from dataclasses import dataclass

import numpy as np

from .baseline import percent_delta, robust_deviation, rolling_baseline


@dataclass
class FeatureSet:
    columns: list
    X: np.ndarray  # windows x features
    deviations: dict  # metric -> per-window robust deviation (nan allowed)
    percents: dict  # metric -> per-window percent delta
    tracks: dict  # metric -> BaselineTrack
    coverage: np.ndarray  # per window core coverage in [0, 1]
    n_fresh: np.ndarray


def build_features(grid, program):
    metrics = [m for m in program.metrics]
    n = len(grid.ends_ms)
    deviations, percents, tracks = {}, {}, {}
    cols = []
    for metric in metrics:
        s = grid.series.get(metric)
        if s is None:
            deviations[metric] = np.full(n, np.nan)
            percents[metric] = np.full(n, np.nan)
            tracks[metric] = None
        else:
            track = rolling_baseline(s, grid, program)
            tracks[metric] = track
            deviations[metric] = robust_deviation(s, track)
            percents[metric] = percent_delta(s, track)
        cols.append(np.clip(deviations[metric], -DEV_CLIP, DEV_CLIP))

    core = [m for m in program.core]
    core_ok = np.zeros(n)
    for metric in core:
        core_ok += ~np.isnan(deviations[metric])
    coverage = core_ok / max(1, len(core))
    n_fresh = np.zeros(n)
    for metric in metrics:
        s = grid.series.get(metric)
        if s is not None:
            n_fresh += s.fresh
    core_devs = np.column_stack([deviations[m] for m in core]) if core else np.full((n, 1), np.nan)
    with np.errstate(invalid="ignore"), warnings.catch_warnings():
        warnings.simplefilter("ignore", category=RuntimeWarning)
        n_deviating = np.nansum(np.abs(core_devs) >= program.deviation_threshold, axis=1).astype(float)
        any_core = np.any(~np.isnan(core_devs), axis=1)
        mean_abs = np.where(any_core, np.nanmean(np.abs(np.clip(core_devs, -DEV_CLIP, DEV_CLIP)), axis=1), np.nan)
    X = np.column_stack(cols + [coverage, n_fresh, n_deviating, mean_abs])
    columns = [f"dev:{m}" for m in metrics] + ["coverage", "n_fresh", "n_deviating_core", "mean_abs_dev_core"]
    return FeatureSet(columns, X, deviations, percents, tracks, coverage, n_fresh)
