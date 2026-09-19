"""How often does the rule speak when it should, and how long does it take?

`calibrate.py` measures the opposite half: how often the rule fires on people
who are not deteriorating. That number alone flatters any detector, because a
detector that never fires scores perfectly on it. This is the other half.

Nobody in LifeSnaps deteriorated after a discharge, so there is no positive
class to count. Instead each subject's own series is used as the noise floor
and a coordinated deviation of known size and known start is added to it. The
subject's day-to-day variation is real; only the deviation is injected. That
answers a question the false-alarm rate cannot: given how much this person
already moves on their own, how large does a coordinated change have to be
before the rule sees it, and how many days does it take.

Each signal moves in the direction deterioration moves it — heart rate and
breathing up, variability and blood oxygen down — by a multiple of that
subject's own standard deviation, ramped over two days and then sustained.
The baseline for any day is built from every day recorded before it, which is
what detect.py does and what a deployment has on the morning it must decide.
That detail is not cosmetic: freezing the baseline at the onset instead makes
the same rule fire on 10.56% of untouched days rather than 3.35%.

Every injected subject is also run untouched, with the same baseline and the
same rule over the same days, and the control is reported the same way. That
matters more than it sounds: over a fortnight the rule fires at some point for
most of these subjects anyway, so "it caught 78%" means little until you know
the untouched column says 70.7%. The detection rate is the weaker half of this
measurement. The lag is the strong half — a change large enough to be seen is
seen the next day, against a median of five days for background noise.

What it does not establish: that the injected shape is what deterioration
looks like, or that catching it predicts a readmission. It measures the
detector against the pattern the detector was built for. A real sensitivity
figure needs a monitored cohort with recorded outcomes.

Usage:
    python3 analysis/sensitivity.py fixtures/lifesnaps_daily.csv
    python3 analysis/sensitivity.py fixtures/lifesnaps_daily.csv --json out.json
"""

import argparse
import csv
import json
import statistics
from collections import defaultdict

from baseline import MIN_OBSERVATIONS
from detect import MIN_SIGNALS, SIGNALS, THRESHOLD_SD

# Which way deterioration pushes each signal. Injecting a change in the wrong
# direction would measure nothing but the absolute value in the rule.
DIRECTION = {
    "resting_heart_rate": 1,
    "hr_night": 1,
    "hrv_sdnn": -1,
    "respiratory_rate": 1,
    "spo2": -1,
}

EFFECT_SIZES = (1.0, 1.5, 2.0, 2.5, 3.0)
RAMP_DAYS = 2.0
ONSET_FRACTION = 0.7  # deterioration starts this far through the series
MIN_DAYS_AFTER = 5  # a subject needs this long after onset to be judged


def _days(n):
    return f"{n:g} day" + ("" if n == 1 else "s")


def by_subject(path):
    subjects = defaultdict(list)
    with open(path, encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            subjects[row["patient_id"]].append(row)
    return subjects


def series(rows, signal):
    """(index, value) for every day this signal was actually recorded."""
    out = []
    for i, row in enumerate(rows):
        raw = row.get(signal, "")
        if raw in ("", None):
            continue
        try:
            out.append((i, float(raw)))
        except ValueError:
            pass
    return out


def observed(rows, onset, effect):
    """Each signal's recorded days, with the deviation added from onset on.

    `effect` of zero is the control: the subject's own series, untouched.
    """
    out = {}
    for signal in SIGNALS:
        points = series(rows, signal)
        if not points:
            continue
        before = [v for i, v in points if i < onset]
        if len(before) < MIN_OBSERVATIONS:
            continue
        sd = statistics.pstdev(before)
        if sd == 0:
            continue
        step = DIRECTION[signal] * effect * sd
        out[signal] = {
            i: v + (step * min(1.0, (i - onset + 1) / RAMP_DAYS) if i >= onset else 0.0)
            for i, v in points
        }
    return out


def usable(rows):
    """The onset index for a subject the rule could fire for, or None."""
    onset = int(len(rows) * ONSET_FRACTION)
    if onset < MIN_OBSERVATIONS or len(rows) - onset < MIN_DAYS_AFTER:
        return None
    return onset if len(observed(rows, onset, 0.0)) >= MIN_SIGNALS else None


def fires_on(values, day, threshold_sd, min_signals):
    """Does the rule fire on this day, against everything recorded before it?

    The baseline expands as days arrive, which is what detect.py does and what
    a deployment actually has. It matters here: a baseline frozen at the onset
    goes stale and fires three times as often on people who are fine.
    """
    deviating = 0
    for by_day in values.values():
        if day not in by_day:
            continue
        history = [v for i, v in by_day.items() if i < day]
        if len(history) < MIN_OBSERVATIONS:
            continue
        sd = statistics.pstdev(history)
        if sd == 0:
            continue
        if abs((by_day[day] - statistics.mean(history)) / sd) >= threshold_sd:
            deviating += 1
    return deviating >= min_signals


def judge(rows, onset, effect, threshold_sd, min_signals):
    """Days to the first fire after onset, injected and untouched.

    Both arms are measured the same way over the same days, because "the rule
    fired at some point in the fortnight after onset" is not evidence on its
    own: over a window this long the rule fires for most of these subjects
    anyway. The control column is what that comes to, and the difference
    between the two lags is where the signal actually is.
    """
    injected = observed(rows, onset, effect)
    control = observed(rows, onset, 0.0)
    hit = ctrl = None
    fired = 0
    for day in range(onset, len(rows)):
        if hit is None and fires_on(injected, day, threshold_sd, min_signals):
            hit = day - onset
        if fires_on(control, day, threshold_sd, min_signals):
            fired += 1
            if ctrl is None:
                ctrl = day - onset
    return hit, ctrl, fired, len(rows) - onset


def run(subjects, effect, threshold_sd=THRESHOLD_SD, min_signals=MIN_SIGNALS):
    lags, control_lags, judged, detected, control_detected = [], [], 0, 0, 0
    control_fired = control_days = 0
    for rows in subjects.values():
        onset = usable(rows)
        if onset is None:
            continue
        judged += 1
        lag, control_lag, fired, days = judge(rows, onset, effect, threshold_sd, min_signals)
        control_fired += fired
        control_days += days
        if lag is not None:
            detected += 1
            lags.append(lag)
        if control_lag is not None:
            control_detected += 1
            control_lags.append(control_lag)
    return {
        "effect_sd": effect,
        "threshold_sd": threshold_sd,
        "min_signals": min_signals,
        "subjects_judged": judged,
        "detected": detected,
        "detection_pct": round(100 * detected / judged, 1) if judged else None,
        "median_lag_days": round(statistics.median(lags), 1) if lags else None,
        "lag_within_2_days_pct": (
            round(100 * sum(1 for x in lags if x <= 2) / judged, 1) if judged else None
        ),
        "control_detected": control_detected,
        "control_detection_pct": (
            round(100 * control_detected / judged, 1) if judged else None
        ),
        "control_median_lag_days": (
            round(statistics.median(control_lags), 1) if control_lags else None
        ),
        "control_fired_days": control_fired,
        "control_days": control_days,
        "control_rate_pct": (
            round(100 * control_fired / control_days, 2) if control_days else None
        ),
    }


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("infile", nargs="?", default="fixtures/lifesnaps_daily.csv")
    parser.add_argument("--json", help="also write results here")
    args = parser.parse_args()

    subjects = by_subject(args.infile)
    results = [run(subjects, effect) for effect in EFFECT_SIZES]
    judged = results[0]["subjects_judged"] if results else 0

    print(f"{len(subjects)} subjects in the file, {judged} with a pre-onset baseline for "
          f"{MIN_SIGNALS}+ signals\n")
    print(f"coordinated deviation injected at {int(ONSET_FRACTION * 100)}% through each "
          f"subject's own series, ramped over {RAMP_DAYS:.0f} days")
    print(f"rule: {MIN_SIGNALS}+ signals past {THRESHOLD_SD} sd of that subject's own "
          f"pre-onset baseline\n")
    if results:
        base = results[0]
        print(f"  the same days untouched: the rule fires at some point for "
              f"{base['control_detection_pct']}% of them,")
        print(f"  taking a median of {_days(base['control_median_lag_days'])} to do it "
              f"({base['control_rate_pct']}% of individual days).")
        print("  so the rate below is only worth reading next to that, and the lag is"
              "\n  where the difference actually shows.\n")
    print(f"  {'effect':>8}{'caught':>9}{'median lag':>13}{'within 2d':>11}")
    for r in results:
        print(f"  {str(r['effect_sd']) + ' sd':>8}"
              f"{str(r['detection_pct']) + '%':>9}"
              f"{(_days(r['median_lag_days']) if r['median_lag_days'] is not None else '—'):>13}"
              f"{str(r['lag_within_2_days_pct']) + '%':>11}")

    if args.json:
        payload = {
            "method": "coordinated deviation of known size and start injected onto each "
                      "subject's own recorded series; baseline from pre-onset days only",
            "onset_fraction": ONSET_FRACTION,
            "ramp_days": RAMP_DAYS,
            "directions": DIRECTION,
            "results": results,
        }
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
        print(f"\nwrote {args.json}")


if __name__ == "__main__":
    main()
