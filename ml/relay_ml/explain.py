"""Signals, contributors, data quality, and template summaries.

Everything here is traceable to a measurement: percent and robust deviations
from the patient's own median, run durations from observation timestamps,
and the ids of the observations inside each persistent run. Language stays
statistical on purpose; it never names a condition or a risk.
"""

import numpy as np

from .contracts import from_epoch_ms, public_event, to_iso
from .metrics import LEGACY_METRICS, METRICS
from .windows import HOUR_MS, WINDOW_MS

QUALITY_INSUFFICIENT = "Insufficient baseline"
QUALITY_STALE = "Missing recent data"
QUALITY_OK = "Available"


def _r1(x):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), 1)


def _r2(x):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), 2)


def signal_order(program, grid):
    order = list(LEGACY_METRICS)
    for m in program.metrics:
        if m not in order and m in grid.series:
            order.append(m)
    return order


def _terminal_dev_run(devs, threshold):
    """Indices of the run of same-sign deviations >= threshold ending at the last window."""
    n = len(devs)
    if n == 0 or np.isnan(devs[-1]) or abs(devs[-1]) < threshold:
        return []
    sign = np.sign(devs[-1])
    i = n - 1
    while i > 0 and not np.isnan(devs[i - 1]) and abs(devs[i - 1]) >= threshold and np.sign(devs[i - 1]) == sign:
        i -= 1
    return list(range(i, n))


def build_signals(grid, fs, program):
    recent = grid.recent_mask()
    recent_idx = np.flatnonzero(recent)
    T = grid.analyzed_through_ms
    cutoff = T - int(grid.window_hours * HOUR_MS)
    signals = []
    for metric in signal_order(program, grid):
        m = METRICS[metric]
        s = grid.series.get(metric)
        track = fs.tracks.get(metric)
        base = {
            "metric": metric,
            "label": m.label,
            "unit": m.unit,
            "base": m.base,
            "threshold": m.threshold,
            "color": m.color,
            "source": m.source,
        }
        if s is None or track is None:
            signals.append(
                {
                    **base,
                    "baseline": {"mean": None, "sd": None, "median": None, "mad": None, "count": 0, "sufficient": False, "start": None, "end": None},
                    "current": None,
                    "delta": None,
                    "robust_deviation": None,
                    "direction": "none",
                    "duration": 0,
                    "persistence_windows": 0,
                    "flagged": False,
                    "fresh": False,
                    "recent": [],
                    "sourceIds": [],
                    "start": None,
                    "end": None,
                    "quality": QUALITY_INSUFFICIENT,
                }
            )
            continue
        last = len(grid.ends_ms) - 1
        sufficient = bool(track.sufficient[last])
        fresh = bool(s.fresh[last])
        rec_obs = [i for i in range(len(s.times_ms)) if s.times_ms[i] >= cutoff]
        recent_events = [
            {"id": s.ids[i], "metric": metric, "timestamp": to_iso(from_epoch_ms(int(s.times_ms[i]))), "value": float(s.values[i]), "unit": m.unit, "source": None}
            for i in rec_obs
        ]
        current = float(np.mean(s.values[rec_obs])) if rec_obs else None
        median = track.median[last]
        delta = None
        if current is not None and sufficient and abs(median) > 0:
            delta = (current - median) / abs(median) * 100.0
        devs = fs.deviations[metric][recent_idx]
        run = _terminal_dev_run(devs, program.deviation_threshold) if (sufficient and fresh) else []
        run_ids, start_ts, end_ts, duration = [], None, None, 0.0
        if run:
            run_start_ms = int(grid.ends_ms[recent_idx[run[0]]] - WINDOW_MS)
            run_end_ms = int(grid.ends_ms[recent_idx[run[-1]]])
            in_run = [i for i in range(len(s.times_ms)) if run_start_ms < s.times_ms[i] <= run_end_ms]
            if in_run:
                run_ids = [s.ids[i] for i in in_run]
                start_ts = to_iso(from_epoch_ms(int(s.times_ms[in_run[0]])))
                end_ts = to_iso(from_epoch_ms(int(s.times_ms[in_run[-1]])))
                # Duration runs from the first deviated observation to the analysis
                # end: the deviation has held and no newer reading contradicts it.
                # At least two observations must support the run.
                duration = (T - s.times_ms[in_run[0]]) / HOUR_MS
        flagged = bool(
            sufficient
            and fresh
            and len(run) >= program.min_persistence_windows
            and len(run_ids) >= 2
            and duration >= program.min_persistence_hours
        )
        latest_dev = fs.deviations[metric][last]
        direction = "none" if np.isnan(latest_dev) or abs(latest_dev) < 1.0 else ("above_baseline" if latest_dev > 0 else "below_baseline")
        signals.append(
            {
                **base,
                "baseline": {
                    "mean": _r2(track.mean[last]),
                    "sd": _r2(track.sd[last]),
                    "median": _r2(median),
                    "mad": _r2(track.scale[last]),
                    "count": int(track.count[last]),
                    "sufficient": sufficient,
                    "start": to_iso(from_epoch_ms(int(grid.ends_ms[track.start_idx[last]] - WINDOW_MS))) if track.start_idx[last] >= 0 else None,
                    "end": to_iso(from_epoch_ms(int(grid.ends_ms[track.end_idx[last]]))) if track.end_idx[last] >= 0 else None,
                    "method": "median_mad",
                },
                "current": _r1(current),
                "delta": _r1(delta),
                "robust_deviation": _r2(latest_dev),
                "direction": direction,
                "duration": _r1(duration),
                "persistence_windows": len(run),
                "flagged": flagged,
                "fresh": fresh,
                "recent": recent_events,
                "sourceIds": run_ids,
                "start": start_ts,
                "end": end_ts,
                "quality": QUALITY_INSUFFICIENT if not sufficient else (QUALITY_STALE if not fresh else QUALITY_OK),
            }
        )
    return signals


def attach_sources(signals, events):
    """Fill `source` on recent events from the normalized input (public shape)."""
    by_id = {e["id"]: e for e in events}
    for s in signals:
        s["recent"] = [public_event({**by_id[r["id"]]}) if r["id"] in by_id else r for r in s["recent"]]


def coordinated_rule(signals, program):
    flagged = [s for s in signals if s["flagged"] and s["start"] and s["end"]]
    if len(flagged) < program.min_coordinated:
        return False, 0.0
    from .contracts import parse_timestamp

    starts = [parse_timestamp(s["start"]).timestamp() for s in flagged]
    ends = [parse_timestamp(s["end"]).timestamp() for s in flagged]
    overlap = (min(ends) - max(starts)) / 3600.0
    return overlap >= program.min_persistence_hours, max(0.0, overlap)


def build_contributors(grid, fs, program, signals, limit=6):
    last = len(grid.ends_ms) - 1
    by_metric = {s["metric"]: s for s in signals}
    rows = []
    for metric in program.metrics:
        dev = fs.deviations[metric][last] if metric in fs.deviations else np.nan
        if np.isnan(dev) or abs(dev) < 1.0:
            continue
        sig = by_metric.get(metric, {})
        rows.append(
            {
                "metric": metric,
                "label": METRICS[metric].label,
                "direction": "above_baseline" if dev > 0 else "below_baseline",
                "robust_deviation": round(float(dev), 2),
                "percent_delta": _r1(fs.percents[metric][last]),
                "persistence_windows": sig.get("persistence_windows", 0),
                "flagged": bool(sig.get("flagged", False)),
                "supporting_ids": sig.get("sourceIds") or [e["id"] for e in sig.get("recent", [])][-3:],
                "latest_observed_at": sig["recent"][-1]["timestamp"] if sig.get("recent") else None,
            }
        )
    rows.sort(key=lambda r: -abs(r["robust_deviation"]))
    return rows[:limit]


def missing_signals(grid, fs, program):
    last = len(grid.ends_ms) - 1
    out = []
    for metric in program.metrics:
        s = grid.series.get(metric)
        track = fs.tracks.get(metric)
        if s is None:
            out.append({"metric": metric, "reason": "no_data", "core": metric in program.core})
        elif not s.fresh[last]:
            out.append({"metric": metric, "reason": "stale", "core": metric in program.core, "age_hours": _r1(s.age_hours[last]) if np.isfinite(s.age_hours[last]) else None})
        elif track is None or not track.sufficient[last]:
            out.append({"metric": metric, "reason": "insufficient_baseline", "core": metric in program.core, "baseline_count": int(track.count[last]) if track is not None else 0})
    return out


def data_quality(grid, fs, program, missing):
    recent = grid.recent_mask()
    coverage = float(np.mean(fs.coverage[recent])) if recent.any() else 0.0
    last = len(grid.ends_ms) - 1
    core_ready = sum(1 for m in program.core if m in fs.deviations and not np.isnan(fs.deviations[m][last]))
    if coverage < program.coverage_partial or core_ready < 2:
        status = "insufficient"
    elif coverage < program.coverage_sufficient:
        status = "partial"
    else:
        status = "sufficient"
    return {
        "status": status,
        "coverage": round(coverage, 3),
        "core_metrics_ready": int(core_ready),
        "core_metrics_total": len(program.core),
        "missing_core": [m["metric"] for m in missing if m["core"]],
        "cadence_hours": round(float(grid.cadence_hours), 2),
        "windows_total": int(len(grid.ends_ms)),
        "windows_recent": int(recent.sum()),
        "windows_history": int((~recent).sum()),
    }


def rule_text(program, model_status):
    model = (
        "An Isolation Forest fitted to this patient's own history windows (chronological train/validation split, "
        f"threshold at the {int(program.validation_quantile * 100)}th validation percentile) flags unusual combinations; "
        f"a flag must persist for {program.min_persistence_windows} consecutive six-hour windows."
        if model_status == "fitted"
        else "A synthetic-only prior model stands in until this patient has enough history."
        if model_status == "prior"
        else "The unsupervised model was unavailable for this window; only the deterministic rule applied."
    )
    return (
        f"At least {program.min_coordinated} signals, each >= {program.deviation_threshold} robust deviations from the patient's "
        f"own median (MAD-scaled) for >= {program.min_persistence_hours:g} hours, with >= {program.min_persistence_hours:g} hours "
        f"of shared overlap. Baseline: preceding {program.baseline_days} days of observed windows; minimum "
        f"{program.min_baseline_points} windows spanning {program.min_baseline_span_hours:g} hours; stale windows never count as normal. "
        f"{model} Structured check-in context and program protocol rules are applied outside the model. "
        "Demo configuration, not clinically validated."
    )


def summary_text(application_state, signals, contributors, anomaly_score, context, protocol_notes, missing, program):
    parts = []
    flagged = [s for s in signals if s["flagged"]]
    if application_state == "insufficient_data":
        names = ", ".join(METRICS[m["metric"]].label.lower() for m in missing if m["core"]) or "core signals"
        parts.append(f"Not enough reliable recent data to interpret the pattern. Missing or stale: {names}.")
    elif flagged:
        for s in flagged:
            word = "above" if s["delta"] >= 0 else "below"
            parts.append(
                f"{s['label']} was {abs(s['delta'])}% {word} this patient's baseline for {s['duration']:g} hours "
                f"(robust deviation {s['robust_deviation']:+.1f})."
            )
    elif application_state in ("context_needed", "review_recommended") and contributors:
        top = "; ".join(f"{c['label'].lower()} {c['robust_deviation']:+.1f}" for c in contributors[:3])
        parts.append(
            f"The combination of recent measurements is unusual for this patient (anomaly score {anomaly_score:.2f}); "
            f"largest robust deviations: {top}. No single signal met the persistence rule on its own."
        )
    else:
        parts.append("No persistent coordinated deviation met the program rule. Inspect data coverage before interpreting this result.")
    if context:
        answered = [f"{k.replace('_', ' ')} — {v}" for k, v in context.items() if k in program.context_fields and v is not None]
        if answered:
            parts.append("Patient-reported context: " + "; ".join(answered) + ".")
    elif application_state in ("context_needed",):
        parts.append("Patient context is missing; a consented check-in is available.")
    for note in protocol_notes:
        parts.append(note + " Illustrative protocol rule, applied outside the model.")
    return " ".join(parts)
