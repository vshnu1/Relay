"""Coordinated deviation detection -> statistical evidence objects.

This is the deterministic core described in the handoff doc. It decides what
gets surfaced; the AI layer only narrates what this produces. Keeping the
decision here and out of the model is what lets the product claim its output
is auditable.

A day is surfaced when at least MIN_SIGNALS independent signals sit beyond
THRESHOLD_SD of that patient's own trailing baseline. Single-signal excursions
are deliberately ignored: one high reading is noise, several systems moving
together is a pattern.

Every emitted object carries the numbers behind it, so any statement made
downstream can be traced back to the measurement that produced it.

Usage:
    python3 analysis/detect.py fixtures/daily_deid.csv fixtures/evidence.json
"""
import json
import sys
from datetime import datetime, timezone

from baseline import MIN_OBSERVATIONS, SIGNALS, baselines, load
from language_guard import enforce

THRESHOLD_SD = 1.5
MIN_SIGNALS = 2
BASELINE_WINDOW = None  # None = all history before the day under test

UNITS = {
    "resting_heart_rate": "bpm", "hr_night": "bpm", "hrv_sdnn": "ms",
    "respiratory_rate": "breaths/min", "spo2": "%",
}

# Asked only when passive data is ambiguous. These collect context, they do
# not screen for a condition.
CONTEXT_QUESTIONS = [
    "Any recent exercise or unusually strenuous activity?",
    "Any new or worsening pain?",
    "Any fever, nausea, dizziness, or wound changes?",
    "Were any medications missed or changed?",
]


def value_of(row, signal):
    raw = row.get(signal, "")
    if raw in ("", None):
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def evaluate_day(rows, index):
    """Score one day against the patient's own history. None if nothing stands out."""
    row = rows[index]
    base = baselines(rows, exclude_index=index, window=BASELINE_WINDOW)

    deviations, missing, insufficient = [], [], []
    for signal in SIGNALS:
        value = value_of(row, signal)
        stats = base.get(signal)
        if value is None:
            missing.append(signal)
            continue
        if stats is None or not stats["usable"]:
            insufficient.append(signal)
            continue
        z = (value - stats["mean"]) / stats["sd"]
        if abs(z) < THRESHOLD_SD:
            continue
        deviations.append({
            "signal": signal,
            "value": round(value, 2),
            "unit": UNITS.get(signal, ""),
            "baseline_mean": stats["mean"],
            "baseline_sd": stats["sd"],
            "baseline_observations": stats["n"],
            "z_score": round(z, 2),
            "percent_from_baseline": round(100 * (value - stats["mean"]) / stats["mean"], 1),
            "direction": "above" if z > 0 else "below",
        })

    if len(deviations) < MIN_SIGNALS:
        return None

    observed = len(SIGNALS) - len(missing) - len(insufficient)
    # Missing signals are the difference between "nothing else moved" and
    # "we could not see whether anything else moved". The doc treats that
    # distinction as a first-class output, not a footnote.
    context_needed = bool(missing)

    notes = []
    if missing:
        notes.append(f"No reading recorded for: {', '.join(missing)}.")
    if insufficient:
        notes.append(f"Baseline not yet established for: {', '.join(insufficient)}.")
    if not notes:
        notes.append("All monitored signals reported on this day.")

    return {
        "evidence_id": f"{row.get('patient_id','unknown')}-{row['date']}",
        "patient_id": row.get("patient_id", "unknown"),
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "observation_date": row["date"],
        "study_day": int(row["study_day"]) if row.get("study_day") else None,
        "status": "context_incomplete" if context_needed else "review_suggested",
        "headline": enforce("Statistical review trigger"),
        "summary": enforce(
            f"{len(deviations)} of {observed} monitored signals sit beyond "
            f"{THRESHOLD_SD} standard deviations of this patient's own baseline."
        ),
        "signals": sorted(deviations, key=lambda d: -abs(d["z_score"])),
        "data_quality": {
            "signals_observed": observed,
            "signals_missing": missing,
            "signals_insufficient_baseline": insufficient,
            "heart_rate_samples": int(row.get("hr_samples") or 0),
            "notes": notes,
        },
        "context": {
            "requested": context_needed,
            "questions": CONTEXT_QUESTIONS if context_needed else [],
            "responses": [],
        },
        "provenance": {
            "source": row.get("device_class", "unknown"),
            "threshold_sd": THRESHOLD_SD,
            "min_signals": MIN_SIGNALS,
            "min_baseline_observations": MIN_OBSERVATIONS,
            "baseline_window_days": BASELINE_WINDOW or "all prior history",
        },
    }


def add_persistence(events):
    """Mark runs of consecutive surfaced days. The doc asks for persistent
    patterns, so a one-day blip and a three-day run must be distinguishable."""
    by_day = {e["study_day"]: e for e in events if e["study_day"] is not None}
    for event in events:
        day = event["study_day"]
        if day is None:
            event["persistence"] = {"consecutive_days": 1}
            continue
        run, cursor = 1, day - 1
        while cursor in by_day:
            run += 1
            cursor -= 1
        event["persistence"] = {
            "consecutive_days": run,
            "continues_next_day": (day + 1) in by_day,
        }
    return events


def detect(rows):
    events = [e for e in (evaluate_day(rows, i) for i in range(len(rows))) if e]
    return add_persistence(events)


def main():
    infile = sys.argv[1] if len(sys.argv) > 1 else "fixtures/daily_deid.csv"
    outfile = sys.argv[2] if len(sys.argv) > 2 else "fixtures/evidence.json"
    rows = load(infile)
    events = detect(rows)

    with open(outfile, "w", encoding="utf-8") as handle:
        json.dump(events, handle, indent=2)

    print(f"{outfile}: {len(events)} evidence objects from {len(rows)} patient-days\n")
    for event in events:
        signals = ", ".join(
            f"{s['signal']} {s['value']}{s['unit']} ({s['z_score']:+} sd)" for s in event["signals"]
        )
        print(f"{event['observation_date']}  [{event['status']}]")
        print(f"   {signals}")
        if event["context"]["requested"]:
            print(f"   context check-in triggered: missing {', '.join(event['data_quality']['signals_missing'])}")


if __name__ == "__main__":
    main()
