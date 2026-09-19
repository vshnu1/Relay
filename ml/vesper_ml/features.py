"""Feature matrix: robust deviations plus missingness and coverage.

One row per six-hour window. Columns are the robust deviation of every
program metric (nan when stale or without a sufficient baseline) followed by
two coverage features: the fraction of core metrics that are fresh with a
sufficient baseline, and the count of fresh program metrics. Missingness
indicators are added downstream by `SimpleImputer(add_indicator=True)`.
"""

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
        cols.append(deviations[metric])

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
    X = np.column_stack(cols + [coverage, n_fresh]) if cols else np.column_stack([coverage, n_fresh])
    columns = [f"dev:{m}" for m in metrics] + ["coverage", "n_fresh"]
    return FeatureSet(columns, X, deviations, percents, tracks, coverage, n_fresh)
