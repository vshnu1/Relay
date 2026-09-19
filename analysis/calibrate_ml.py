"""False-positive rate for the ML engine, measured on a real cohort.

docs/ML.md reports "0 context_needed over 61 daily points" from one person.
That is not a false-positive rate — 61 points from one subject cannot
estimate one. The deterministic rule has a measured figure (3.35% of
subject-days across 71 people, fixtures/calibration.json); the model has
nothing comparable, so the two cannot be argued about on equal terms.

This runs the real scoring path over every LifeSnaps subject. Nobody in that
cohort is recovering from surgery, so every state above `monitoring` is a
false alarm. It produces the number a clinician asks for first.

Requires numpy and scikit-learn, like the rest of ml/.

Usage:
    PYTHONPATH=ml python3 analysis/calibrate_ml.py
    PYTHONPATH=ml python3 analysis/calibrate_ml.py --program stroke_rehabilitation
"""
import argparse
import csv
import json
import sys
from collections import Counter, defaultdict

# our column -> (engine metric key, unit)
CONTRACT = {
    "resting_heart_rate": ("rhr", "bpm"),
    "hrv_sdnn": ("hrv", "ms"),
    "respiratory_rate": ("respiratory", "/min"),
    "spo2": ("spo2", "%"),
    "sleep_hours": ("sleep", "h"),
}

# Below this a subject has no usable history and the engine would rightly
# report insufficient_data, which says nothing about false alarms.
MIN_DAYS = 21
SOURCE = "LifeSnaps cohort"


def subject_events(rows):
    events = []
    for row in rows:
        for column, (metric, unit) in CONTRACT.items():
            raw = row.get(column, "")
            if raw in ("", None):
                continue
            try:
                value = round(float(raw), 3)
            except ValueError:
                continue
            if not 0 < value <= 1000:
                continue
            events.append({
                "metric": metric, "value": value, "unit": unit,
                "timestamp": f"{row['date']}T12:00:00Z", "source": SOURCE,
            })
    events.sort(key=lambda e: (e["timestamp"], e["metric"]))
    return events


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("infile", nargs="?", default="fixtures/lifesnaps_daily.csv")
    parser.add_argument("--program", default="post_abdominal_surgery")
    parser.add_argument("--json", help="also write the result here")
    args = parser.parse_args()

    try:
        from vesper_ml.score import score_request
    except ImportError as exc:
        sys.exit(f"cannot import the engine ({exc}). Run with PYTHONPATH=ml and numpy/scikit-learn installed.")

    by_subject = defaultdict(list)
    with open(args.infile, encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            by_subject[row.get("patient_id", "?")].append(row)
    for rows in by_subject.values():
        rows.sort(key=lambda r: r["date"])

    states, scored, skipped, errors = Counter(), 0, 0, 0
    anomaly_scores, escalated = [], []
    for subject, rows in sorted(by_subject.items()):
        if len(rows) < MIN_DAYS:
            skipped += 1
            continue
        events = subject_events(rows)
        if len(events) < 40:
            skipped += 1
            continue
        try:
            result = score_request({"program": args.program, "events": events,
                                    "patient_id": subject, "seed": 0})
        except Exception:
            errors += 1
            continue
        scored += 1
        state = result["application_state"]
        states[state] += 1
        if result.get("anomaly_score") is not None:
            anomaly_scores.append(result["anomaly_score"])
        # Nobody here is deteriorating, so anything above monitoring is a
        # false alarm; insufficient_data is neither a hit nor a miss.
        if state in ("context_needed", "review_recommended"):
            escalated.append({"subject": subject, "state": state,
                              "anomaly_score": result.get("anomaly_score"),
                              "flagged": [s["metric"] for s in result["signals"] if s["flagged"]]})

    judged = scored - states.get("insufficient_data", 0)
    rate = round(100 * len(escalated) / judged, 2) if judged else None

    print(f"program: {args.program}")
    print(f"subjects scored: {scored}  (skipped {skipped} with under {MIN_DAYS} days, {errors} errors)\n")
    for state, n in states.most_common():
        print(f"  {state:<20}{n:>5}")
    print(f"\n  judged (excluding insufficient_data): {judged}")
    print(f"  false alarms: {len(escalated)}")
    print(f"  FALSE-POSITIVE RATE: {rate}% of judged subjects")
    print(f"\n  compare: the deterministic rule measures 3.35% of subject-days at 1.75 sd")
    print("  (different denominators — subjects here, subject-days there)")
    if anomaly_scores:
        ordered = sorted(anomaly_scores)
        q = lambda p: ordered[min(len(ordered) - 1, int(len(ordered) * p))]
        print(f"\n  anomaly score  median {q(0.5)}  p90 {q(0.9)}  p99 {q(0.99)}  max {ordered[-1]}")
    for hit in escalated[:6]:
        print(f"    {hit['subject']}  {hit['state']}  score={hit['anomaly_score']}  flagged={hit['flagged']}")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump({"program": args.program, "subjects_scored": scored, "states": dict(states),
                       "judged": judged, "false_alarms": len(escalated),
                       "false_positive_rate_pct": rate, "escalations": escalated}, handle, indent=2)
        print(f"\nwrote {args.json}")


if __name__ == "__main__":
    main()
