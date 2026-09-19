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

Only a program whose core metrics this cohort records can be measured here:
LifeSnaps has no temperature, weight or gait columns, so nine of the fourteen
programs cannot be, and the tool says so rather than scoring them on nothing.

Usage:
    PYTHONPATH=ml python3 analysis/calibrate_ml.py
    PYTHONPATH=ml python3 analysis/calibrate_ml.py --program copd_recovery
    PYTHONPATH=ml python3 analysis/calibrate_ml.py --all --json fixtures/ml_calibration.json
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
    # Adding steps leaves post_abdominal_surgery's figure exactly where it was
    # (52 judged, 3 alarms) and brings cardiac_recovery into reach.
    "steps": ("steps", "count"),
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


def calibratable(program_key):
    """Whether this cohort records every core metric the program needs."""
    from relay_ml.programs import PROGRAMS

    have = {metric for metric, _ in CONTRACT.values()}
    return set(PROGRAMS[program_key].core) <= have


def calibrate(by_subject, program, quiet=False):
    """Score every subject as `program` and count the states. Returns the record."""
    from relay_ml.score import score_request

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
            result = score_request({"program": program, "events": events,
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
    record = {"program": program, "subjects_scored": scored, "skipped": skipped, "errors": errors,
              "states": dict(states), "judged": judged, "false_alarms": len(escalated),
              "false_positive_rate_pct": rate, "escalations": escalated}
    if quiet:
        return record

    print(f"program: {program}")
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
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("infile", nargs="?", default="fixtures/lifesnaps_daily.csv")
    parser.add_argument("--program", default="post_abdominal_surgery")
    parser.add_argument("--all", action="store_true",
                        help="every program whose core metrics this cohort records, in one table")
    parser.add_argument("--json", help="also write the result here")
    args = parser.parse_args()

    try:
        from relay_ml.programs import PROGRAMS
        import relay_ml.score  # noqa: F401
    except ImportError as exc:
        sys.exit(f"cannot import the engine ({exc}). Run with PYTHONPATH=ml and numpy/scikit-learn installed.")

    by_subject = defaultdict(list)
    with open(args.infile, encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            by_subject[row.get("patient_id", "?")].append(row)
    for rows in by_subject.values():
        rows.sort(key=lambda r: r["date"])

    if args.all:
        programs = [k for k in PROGRAMS if calibratable(k)]
        left_out = [k for k in PROGRAMS if not calibratable(k)]
    else:
        if not calibratable(args.program):
            missing = sorted(set(PROGRAMS[args.program].core) - {m for m, _ in CONTRACT.values()})
            sys.exit(f"{args.program} counts {', '.join(missing)}, which this cohort does not record; "
                     "a false-positive rate measured without them would be about the wrong program.")
        programs, left_out = [args.program], []

    records = {k: calibrate(by_subject, k, quiet=args.all) for k in programs}

    if args.all:
        print(f"false-positive rate of the model, per program, on {len(by_subject)} LifeSnaps subjects")
        print("(nobody is deteriorating, so every state above monitoring is a false alarm)\n")
        print(f"  {'program':<30}{'judged':>8}{'alarms':>8}{'rate':>8}")
        for k, r in records.items():
            print(f"  {k:<30}{r['judged']:>8}{r['false_alarms']:>8}{str(r['false_positive_rate_pct']) + '%':>8}")
        print(f"\n  not measurable here — core needs columns this cohort lacks: {', '.join(left_out)}")

    if args.json:
        payload = {
            "cohort": {"file": args.infile, "subjects": len(by_subject), "min_days": MIN_DAYS,
                       "metrics_available": sorted({m for m, _ in CONTRACT.values()})},
            "not_calibratable": left_out if args.all else [],
            "programs": records,
        }
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
        print(f"\nwrote {args.json}")


if __name__ == "__main__":
    main()
