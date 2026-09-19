"""Cohort evaluation on the de-identified LifeSnaps daily fixture.

Scores every subject in `fixtures/lifesnaps_daily.csv` (public, CC-BY-4.0,
anonymized; committed by the data workstream) through one program at the
subject's latest day and writes an aggregate-only report: state tallies,
score quantiles, gate counts. Nobody in the cohort is post-surgical, so a
`context_needed` here is a presumed false positive, not a confirmed one:
the dataset has no clinical outcome labels.

    PYTHONPATH=ml python3 -m relay_ml cohort-eval [--program post_abdominal_surgery]

Subject-level rows never leave this function; only counts are reported.
"""

import collections
import csv
import json
import os
import sys
import time

import numpy as np

from . import MODEL_VERSION
from .contracts import ContractError
from .score import score_request

FIXTURE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "fixtures", "lifesnaps_daily.csv")
REPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "reports")
COLUMNS = {
    "resting_heart_rate": ("rhr", "bpm"),
    "hrv_sdnn": ("hrv", "ms"),  # LifeSnaps ships RMSSD; within-subject deviations cancel the difference
    "respiratory_rate": ("respiratory", "/min"),
    "spo2": ("spo2", "%"),
    "sleep_hours": ("sleep", "h"),
    "steps": ("steps", "count"),
    "hr_night": ("heart_rate", "bpm"),
}


def subject_events(rows, hour="12"):
    events = []
    for r in rows:
        for col, (metric, unit) in COLUMNS.items():
            try:
                v = float(r.get(col, ""))
            except (TypeError, ValueError):
                continue
            if v != v:
                continue
            events.append({"metric": metric, "value": v, "unit": unit, "timestamp": f"{r['date'][:10]}T{hour}:00:00Z", "source": "wearable"})
    return events


def evaluate(program="post_abdominal_surgery", fixture=None, seed=0, min_days=1):
    fixture = fixture or FIXTURE
    with open(fixture, newline="") as fh:
        rows = list(csv.DictReader(fh))
    by = collections.defaultdict(list)
    for r in rows:
        by[r["patient_id"]].append(r)
    t0 = time.perf_counter()
    states, dq, model_status = collections.Counter(), collections.Counter(), collections.Counter()
    scores, flagged_any, contributors_when_fired, neutralized, no_contrib = [], 0, [], 0, 0
    skipped = 0
    for pid, rs in by.items():
        if len(rs) < min_days:
            skipped += 1
            continue
        try:
            r = score_request({"events": subject_events(rs), "context": None, "program": program}, seed=seed)
        except ContractError:
            states["contract_error"] += 1
            continue
        states[r["application_state"]] += 1
        dq[r["data_quality"]["status"]] += 1
        model_status[r["model"]["status"]] += 1
        if r["anomaly_score"] is not None:
            scores.append(r["anomaly_score"])
        if any(s["flagged"] for s in r["signals"]):
            flagged_any += 1
        if r["model"].get("latest_explained_by_missingness"):
            neutralized += 1
        if r["model"].get("anomaly_without_contributors"):
            no_contrib += 1
        if r["application_state"] == "context_needed":
            contributors_when_fired.append(len(r["contributors"]))
    evaluable = states["monitoring"] + states["context_needed"] + states["review_recommended"]
    report = {
        "model_version": MODEL_VERSION,
        "program": program,
        "note": "Aggregate only. LifeSnaps has no clinical labels; context requests are presumed, not confirmed, false positives.",
        "subjects_total": len(by),
        "subjects_skipped_min_days": skipped,
        "subjects_scored": sum(states.values()),
        "evaluable": evaluable,
        "application_states": dict(states),
        "data_quality_status": dict(dq),
        "model_status": dict(model_status),
        "context_needed_rate_over_evaluable": round(states["context_needed"] / evaluable, 4) if evaluable else None,
        "subjects_with_any_flagged_signal": flagged_any,
        "context_needed_contributor_counts": contributors_when_fired,
        "subjects_latest_window_explained_by_missingness": neutralized,
        "subjects_persistent_flag_without_contributors": no_contrib,
        "anomaly_score_quantiles": {q: round(float(np.quantile(scores, float(q))), 3) for q in ("0.5", "0.9", "0.95", "0.99")} if scores else {},
        "seed": seed,
        "elapsed_seconds": round(time.perf_counter() - t0, 1),
    }
    return report


def run(program="post_abdominal_surgery", fixture=None, report=None, seed=0):
    out = evaluate(program=program, fixture=fixture, seed=seed)
    report = report or os.path.join(REPORT_DIR, f"lifesnaps_cohort_eval_{program}.json")
    os.makedirs(os.path.dirname(report), exist_ok=True)
    with open(report, "w") as fh:
        json.dump(out, fh, indent=2)
    json.dump(out, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0
