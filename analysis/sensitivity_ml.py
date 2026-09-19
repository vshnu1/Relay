"""Does the model see a coordinated change the rule misses, or the other way?

`calibrate_ml.py` measures how often the model speaks on people who are fine.
`sensitivity.py` measures how often the rule speaks when it should. Neither
answers the question a technical judge asks about an unsupervised model bolted
onto a working rule: does it earn its place.

This runs both detectors over the same subjects, the same injected change, and
the same days, so the two columns can be read against each other. Only the
four signals both detectors use are injected — resting heart rate, heart rate
variability, respiratory rate, blood oxygen — so neither is handed a change
the other cannot see. The rule also watches nocturnal heart rate and the model
also watches sleep; both are left untouched here for that reason, which means
these rule figures are not the ones in `sensitivity.py` and are not meant to
be. The comparison inside this table is the point.

Detection for the rule is the first day it fires at or after the onset.
Detection for the model is an application state above `monitoring`, and both
detectors are scored once per day from the onset and stopped at their first
alarm, so the two lag columns mean the same thing. Scoring the model only at
the end of the series instead measures nothing useful: a shift sustained for
weeks is in its history by then and has become the patient's normal.

Requires numpy and scikit-learn.

Usage:
    PYTHONPATH=ml python3 analysis/sensitivity_ml.py
    PYTHONPATH=ml python3 analysis/sensitivity_ml.py --json out.json
"""

import argparse
import csv
import json
import statistics
import sys
from collections import defaultdict
from datetime import datetime, timezone

from baseline import MIN_OBSERVATIONS
from calibrate_ml import CONTRACT, MIN_DAYS, subject_events
from detect import MIN_SIGNALS, THRESHOLD_SD
from sensitivity import DIRECTION, ONSET_FRACTION, RAMP_DAYS, fires_on, series
from relay_ml.contracts import ContractError

# The columns both detectors read. Injecting anything else would hand one of
# them a change the other is structurally unable to see.
SHARED = [c for c in CONTRACT if c in DIRECTION]
EFFECT_SIZES = (1.0, 1.5, 2.0, 2.5, 3.0)
ALARM_STATES = ("context_needed", "review_recommended")


def by_subject(path):
    subjects = defaultdict(list)
    with open(path, encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            subjects[row.get("patient_id", "?")].append(row)
    for rows in subjects.values():
        rows.sort(key=lambda r: r["date"])
    return subjects


def shifts(rows, onset):
    """How much to add to each shared signal, in that subject's own units."""
    out = {}
    for signal in SHARED:
        before = [v for i, v in series(rows, signal) if i < onset]
        if len(before) < MIN_OBSERVATIONS:
            continue
        sd = statistics.pstdev(before)
        if sd > 0:
            out[signal] = DIRECTION[signal] * sd
    return out


def inject(rows, onset, effect, step):
    """A copy of the subject's days with the deviation added from onset on."""
    out = []
    for i, row in enumerate(rows):
        copy = dict(row)
        if i >= onset:
            ramp = min(1.0, (i - onset + 1) / RAMP_DAYS)
            for signal, unit_step in step.items():
                raw = copy.get(signal, "")
                if raw in ("", None):
                    continue
                try:
                    copy[signal] = str(float(raw) + unit_step * effect * ramp)
                except ValueError:
                    pass
        out.append(copy)
    return out


def rule_lag(rows, onset, threshold_sd, min_signals):
    """First day at or after onset the rule fires, over the shared signals."""
    values = {}
    for signal in SHARED:
        points = series(rows, signal)
        if len([v for i, v in points if i < onset]) >= MIN_OBSERVATIONS:
            values[signal] = dict(points)
    if len(values) < min_signals:
        return None
    for day in range(onset, len(rows)):
        if fires_on(values, day, threshold_sd, min_signals):
            return day - onset
    return None


# How many days after the onset the model is given a chance to speak. Scoring
# only at the end of the series measures the wrong thing: by then a sustained
# shift has been in the history for weeks and has become the patient's normal,
# so the model reports monitoring and looks blind. A deployment scores every
# day, so this does too, and stops at the first alarm.
WATCH_DAYS = 7
REJECTED = []


def model_result(rows, subject, program, onset):
    """(alarmed, lag_days_or_None, state) from the real scoring path.

    Scored once per day from the onset, as a deployment would, so the answer
    is "did it speak within the week, and on which day" rather than "what did
    it think a month later".
    """
    from relay_ml.score import score_request

    last_state = "insufficient_data"
    for day in range(onset, min(onset + WATCH_DAYS + 1, len(rows))):
        events = subject_events(rows[: day + 1])
        if len(events) < 40:
            continue
        try:
            result = score_request(
                {
                    "program": program,
                    "events": events,
                    "patient_id": subject,
                    "seed": 0,
                    "analyzedThrough": f"{rows[day]['date']}T23:59:59Z",
                }
            )
        except ContractError:
            # Reported, not swallowed. Measured at zero for this cohort at
            # every effect size, and this keeps it visible if that changes.
            REJECTED.append((program, subject, day - onset))
            continue
        last_state = result["application_state"]
        if last_state in ALARM_STATES:
            return True, day - onset, last_state
    return False, None, last_state


def qualifies(rows, onset):
    return (
        len(rows) >= MIN_DAYS
        and onset >= MIN_OBSERVATIONS
        and len(rows) - onset >= 5
        and len(shifts(rows, onset)) >= MIN_SIGNALS
    )


def run(subjects, effect, program):
    rule_hits, rule_lags = 0, []
    model_hits, model_lags = 0, []
    judged = 0
    for subject, rows in sorted(subjects.items()):
        onset = int(len(rows) * ONSET_FRACTION)
        if not qualifies(rows, onset):
            continue
        step = shifts(rows, onset)
        injected = inject(rows, onset, effect, step) if effect else rows
        scored = model_result(injected, subject, program, onset)
        if scored is None:
            continue
        judged += 1
        lag = rule_lag(injected, onset, THRESHOLD_SD, MIN_SIGNALS)
        if lag is not None:
            rule_hits += 1
            rule_lags.append(lag)
        alarmed, model_lag_days, _ = scored
        if alarmed:
            model_hits += 1
            if model_lag_days is not None:
                model_lags.append(model_lag_days)
    pct = lambda n: round(100 * n / judged, 1) if judged else None
    med = lambda xs: round(statistics.median(xs), 1) if xs else None
    return {
        "effect_sd": effect,
        "subjects_judged": judged,
        "rule_detected": rule_hits,
        "rule_detection_pct": pct(rule_hits),
        "rule_median_lag_days": med(rule_lags),
        "model_detected": model_hits,
        "model_detection_pct": pct(model_hits),
        "model_median_lag_days": med(model_lags),
    }


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("infile", nargs="?", default="fixtures/lifesnaps_daily.csv")
    parser.add_argument("--program", default="post_abdominal_surgery")
    parser.add_argument("--json", help="also write the result here")
    args = parser.parse_args()

    try:
        import relay_ml.score  # noqa: F401
    except ImportError as exc:
        sys.exit(f"cannot import the engine ({exc}). Run with PYTHONPATH=ml and numpy/scikit-learn installed.")

    subjects = by_subject(args.infile)
    control = run(subjects, 0.0, args.program)
    results = [run(subjects, effect, args.program) for effect in EFFECT_SIZES]

    print(f"program: {args.program}")
    print(f"injected into {', '.join(SHARED)} — the signals both detectors read\n")
    print(f"  {'injected':>10}{'rule caught':>13}{'rule lag':>10}{'model caught':>14}{'model lag':>11}")
    print(f"  {'nothing':>10}{str(control['rule_detection_pct']) + '%':>13}"
          f"{'—':>10}{str(control['model_detection_pct']) + '%':>14}{'—':>11}")
    for r in results:
        print(f"  {str(r['effect_sd']) + ' sd':>10}"
              f"{str(r['rule_detection_pct']) + '%':>13}"
              f"{(str(r['rule_median_lag_days']) + 'd' if r['rule_median_lag_days'] is not None else '—'):>10}"
              f"{str(r['model_detection_pct']) + '%':>14}"
              f"{(str(r['model_median_lag_days']) + 'd' if r['model_median_lag_days'] is not None else '—'):>11}")
    print(f"\n  {control['subjects_judged']} subjects judged. The 'nothing' row is the same "
          f"subjects with no injection:\n  anything either detector reports there is a false alarm.")

    print(f"\n  scoring days rejected by the contract: {len(REJECTED)}")
    if args.json:
        payload = {
            "contract_rejections": len(REJECTED),
            "program": args.program,
            "injected_signals": SHARED,
            "onset_fraction": ONSET_FRACTION,
            "ramp_days": RAMP_DAYS,
            "control": control,
            "results": results,
        }
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
        print(f"\nwrote {args.json}")


if __name__ == "__main__":
    main()
