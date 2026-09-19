"""Read-only validation against a private Apple Health export.

Reads through `health_export.read_export`, scores the primary program at the
latest timestamp and back-tests daily analysis points, then writes an
aggregate-only report: counts, month-level coverage, feature dimensions,
timings, state distributions and de-identified model diagnostics. It never
writes events, windows, or any person-level table inside the repository.
"""

import json
import os
import sys
import time
from collections import Counter

from . import MODEL_VERSION
from .contracts import normalize, epoch_ms, from_epoch_ms, parse_timestamp, to_iso
from .health_export import resolve_path, read_export
from .programs import get_program
from .score import score_request
from .windows import HOUR_MS

REPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "reports")
DAY_MS = 24 * HOUR_MS


def _backtest(events, program_key, days, step_days=1):
    """Score at daily analysis points ending at the latest event. Returns counts only."""
    last = max(parse_timestamp(e["timestamp"]) for e in events)
    last_ms = epoch_ms(last)
    states, scores, statuses, model_status = Counter(), [], Counter(), Counter()
    flagged_metrics = Counter()
    elapsed = []
    n = 0
    for k in range(days, -1, -step_days):
        T = last_ms - k * DAY_MS
        t0 = time.perf_counter()
        try:
            r = score_request({"events": events, "context": None, "program": program_key, "analyzedThrough": to_iso(from_epoch_ms(T))})
        except Exception as exc:  # aggregate the failure, never the data
            states[f"error:{type(exc).__name__}"] += 1
            continue
        elapsed.append(time.perf_counter() - t0)
        n += 1
        states[r["application_state"]] += 1
        statuses[r["data_quality"]["status"]] += 1
        model_status[r["model"]["status"]] += 1
        if r["anomaly_score"] is not None:
            scores.append(r["anomaly_score"])
        for s in r["signals"]:
            if s["flagged"]:
                flagged_metrics[s["metric"]] += 1
    import numpy as np

    return {
        "analysis_points": n,
        "application_states": dict(states),
        "data_quality_status": dict(statuses),
        "model_status": dict(model_status),
        "anomaly_score_quantiles": {q: round(float(np.quantile(scores, float(q))), 3) for q in ("0.5", "0.9", "0.95", "0.99")} if scores else {},
        "share_is_anomalous_points": round(states.get("context_needed", 0) / n, 3) if n else None,
        "flagged_signal_counts": dict(flagged_metrics),
        "mean_score_seconds": round(float(np.mean(elapsed)), 3) if elapsed else None,
    }


def run(export_path=None, program="post_abdominal_surgery", report=None, backtest_days=60):
    path = resolve_path(export_path)
    t0 = time.perf_counter()
    events, summary = read_export(path)
    read_s = time.perf_counter() - t0
    if not events:
        print("validate-export: no usable events found", file=sys.stderr)
        return 1
    normalized = normalize(events)

    def subset(metrics):
        return [e for e in events if e["metric"] in metrics]

    out = {
        "model_version": MODEL_VERSION,
        "note": "Aggregate-only report from a private export. No raw observations, dates finer than month, device names, or person-level tables.",
        "export": {**summary, "read_seconds": round(read_s, 2), "normalized_events": len(normalized)},
        "programs": {},
    }
    prog = get_program(program)
    vitals = subset(set(prog.metrics))
    if vitals:
        t1 = time.perf_counter()
        latest = score_request({"events": vitals, "context": None, "program": program})
        out["programs"][program] = {
            "events_used": len(vitals),
            "latest": _latest_summary(latest),
            "latest_score_seconds": round(time.perf_counter() - t1, 3),
            "backtest": _backtest(vitals, program, backtest_days),
        }
    gait_prog = get_program("stroke_rehabilitation")
    gait = subset(set(gait_prog.metrics))
    if gait and program != "stroke_rehabilitation":
        t2 = time.perf_counter()
        latest = score_request({"events": gait, "context": None, "program": "stroke_rehabilitation"})
        out["programs"]["stroke_rehabilitation"] = {
            "events_used": len(gait),
            "latest": _latest_summary(latest),
            "latest_score_seconds": round(time.perf_counter() - t2, 3),
            "backtest": _backtest(gait, "stroke_rehabilitation", backtest_days),
        }
    out["total_seconds"] = round(time.perf_counter() - t0, 2)
    report = report or os.path.join(REPORT_DIR, "private_export_validation.json")
    os.makedirs(os.path.dirname(report), exist_ok=True)
    with open(report, "w") as fh:
        json.dump(out, fh, indent=2)
    json.dump(out, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def _latest_summary(r):
    return {
        "application_state": r["application_state"],
        "state": r["state"],
        "is_anomalous": r["is_anomalous"],
        "rule_coordinated": r["rule_coordinated"],
        "anomaly_score": r["anomaly_score"],
        "analyzed_through_month": r["analyzedThrough"][:7],
        "data_quality": {k: v for k, v in r["data_quality"].items()},
        "missing_signals": [{"metric": m["metric"], "reason": m["reason"]} for m in r["missing_signals"]],
        "contributors": [{"metric": c["metric"], "direction": c["direction"], "robust_deviation": c["robust_deviation"], "persistence_windows": c["persistence_windows"]} for c in r["contributors"]],
        "signals": {s["metric"]: {"quality": s["quality"], "baseline_count": s["baseline"]["count"], "flagged": s["flagged"]} for s in r["signals"]},
        "model": {k: v for k, v in r["model"].items() if k not in ("window_scores",)},
    }
