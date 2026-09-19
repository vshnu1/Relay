"""Request -> evidence. The only entry point the CLI and tests need."""

import math
import time

import numpy as np

from . import MODEL_VERSION
from .contracts import STATE_TO_LEGACY, ContractError, epoch_ms, from_epoch_ms, normalize, normalize_context, parse_timestamp, public_event, to_iso
from .explain import (
    attach_sources,
    build_contributors,
    build_signals,
    coordinated_rule,
    data_quality,
    missing_signals,
    rule_text,
    summary_text,
)
from .features import build_features
from .model import fit_and_score, load_prior, terminal_run
from .programs import get_program
from .windows import HOUR_MS, WINDOW_MS, build_grid


def _clean(obj):
    """Make the result JSON-safe: numpy scalars to Python, nan/inf to None."""
    if isinstance(obj, dict):
        return {str(k): _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        f = float(obj)
        return None if (math.isnan(f) or math.isinf(f)) else f
    if isinstance(obj, np.ndarray):
        return _clean(obj.tolist())
    return obj


def decide_state(dq_status, is_anomalous, rule_coordinated, context, protocol_hits):
    if protocol_hits and context and context.get("consent", True):
        return "review_recommended"
    if dq_status == "insufficient":
        return "insufficient_data"
    if is_anomalous or rule_coordinated:
        return "review_recommended" if context else "context_needed"
    return "monitoring"


def protocol_matches(program, context):
    if not context:
        return []
    notes = []
    for rule in program.protocol_rules:
        if rule.field in context and context[rule.field] == rule.equals:
            notes.append(rule.note)
    return notes


def score_request(request, seed=None, artifact_dir=None):
    t0 = time.perf_counter()
    if not isinstance(request, dict):
        raise ContractError("request must be a JSON object")
    program = get_program(request.get("program"))
    events = normalize(request.get("events"))
    context = normalize_context(request.get("context"))
    seed = int(request.get("seed", 0)) if seed is None else seed

    analyzed_through = request.get("analyzedThrough")
    if analyzed_through:
        T = epoch_ms(parse_timestamp(analyzed_through))
        events = [e for e in events if e["_ms"] <= T]
        if not events:
            raise ContractError("analyzedThrough precedes every event")
    else:
        T = events[-1]["_ms"]

    grid = build_grid(events, analyzed_through_ms=T, core_metrics=program.core)
    fs = build_features(grid, program)
    recent = grid.recent_mask()
    hist = ~recent
    prior = load_prior(program.key, artifact_dir)
    model = fit_and_score(fs.X[hist], fs.X[recent], fs.core_columns, quantile=program.validation_quantile, seed=seed, prior=prior)

    signals = build_signals(grid, fs, program)
    attach_sources(signals, events)
    rule_coordinated, overlap = coordinated_rule(signals, program)
    missing = missing_signals(grid, fs, program)
    dq = data_quality(grid, fs, program, missing)
    contributors = build_contributors(grid, fs, program, signals)

    if model.status in ("fitted", "prior") and len(model.flags_recent):
        run_len, run_start = terminal_run(model.flags_recent)
        is_anomalous = run_len >= program.min_persistence_windows and dq["status"] != "insufficient"
        anomaly_score = float(model.scores_recent[-1])
        recent_idx = np.flatnonzero(recent)
        change_point = to_iso(from_epoch_ms(int(grid.ends_ms[recent_idx[run_start]] - WINDOW_MS))) if run_start is not None else None
        window_scores = [round(float(x), 3) for x in model.scores_recent]
    else:
        is_anomalous, anomaly_score, change_point, window_scores = False, None, None, []
    if not is_anomalous and rule_coordinated:
        # change point from the deterministic rule: earliest flagged run start
        starts = [s["start"] for s in signals if s["flagged"] and s["start"]]
        change_point = min(starts) if starts else change_point

    protocol_notes = protocol_matches(program, context)
    application_state = decide_state(dq["status"], is_anomalous, rule_coordinated, context, protocol_notes)
    legacy_state = STATE_TO_LEGACY[application_state]
    coordinated = bool(rule_coordinated or is_anomalous)
    summary = summary_text(application_state, signals, contributors, anomaly_score or 0.0, context, protocol_notes, missing, program)

    result = {
        # legacy evidence object (shared/engine.js compatible)
        "cadenceHours": round(float(grid.cadence_hours), 2),
        "windowHours": float(grid.window_hours),
        "signals": signals,
        "coordinated": coordinated,
        "overlapHours": round(float(overlap), 1),
        "analyzedThrough": to_iso(from_epoch_ms(T)),
        "state": legacy_state,
        "summary": summary,
        "context": context,
        "rule": rule_text(program, model.status),
        # additions
        "patient_id": request.get("patient_id"),
        "program": program.key,
        "model_version": MODEL_VERSION,
        "window_start": to_iso(from_epoch_ms(int(grid.ends_ms[np.flatnonzero(recent)[0]] - WINDOW_MS))),
        "window_end": to_iso(from_epoch_ms(T)),
        "application_state": application_state,
        "anomaly_score": None if anomaly_score is None else round(anomaly_score, 3),
        "is_anomalous": bool(is_anomalous),
        "rule_coordinated": bool(rule_coordinated),
        "change_point": change_point,
        "contributors": contributors,
        "missing_signals": missing,
        "data_quality": dq,
        "protocol_notes": protocol_notes,
        "model": {
            "status": model.status,
            "window_scores": window_scores,
            "feature_columns": fs.columns,
            **model.diagnostics,
            "seed": seed,
            "elapsed_seconds": round(time.perf_counter() - t0, 3),
        },
    }
    return _clean(result)
