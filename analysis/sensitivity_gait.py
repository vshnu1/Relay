"""Detection on gait, measured against one real person's own walking.

The two gait programs — stroke rehabilitation and hip or knee replacement —
had no detection figure at all. They cannot have one from LifeSnaps, which
records no gait, and a figure from synthetic subjects would be circular: the
programs' priors were trained on that same generator.

What this repo does have is one person's phone recording walking speed, step
length, walking asymmetry, double-support time and daily steps on 1,451 days
over four years (`fixtures/daily_deid.csv`, de-identified). That is a real
noise floor for gait, from one person. So the method from `sensitivity.py` is
applied to it with the onset slid along the series: every STRIDE_DAYS a
coordinated gait decline of known size and known start is added — speed, step
length, steadiness and steps down, asymmetry and double support up, each by a
multiple of that person's own spread over the preceding HISTORY_DAYS — and
both detectors are asked, once a day for a week, whether they see it. Each
episode is also run untouched, as its own control.

Both detectors read the same injected values and the same HISTORY_DAYS of
history. The rule is the one in detect.py — MIN_SIGNALS past THRESHOLD_SD of
the trailing baseline — applied to gait columns instead of cardiorespiratory
ones. The model is scored through the real path with the program named.

What this is: one person, a few dozen episodes, real day-to-day gait
variation. What it is not: a population figure, or evidence that the injected
shape is what a recovery going wrong looks like. It shows whether the two
detectors respond to a coordinated gait change through one real person's
ordinary variation, and how quickly.

Requires numpy and scikit-learn.

Usage:
    PYTHONPATH=ml python3 analysis/sensitivity_gait.py
    PYTHONPATH=ml python3 analysis/sensitivity_gait.py --json fixtures/sensitivity_gait.json
"""

import argparse
import csv
import json
import statistics
import sys

from baseline import MIN_OBSERVATIONS
from detect import MIN_SIGNALS, THRESHOLD_SD
from sensitivity import RAMP_DAYS, fires_on, series
from vesper_ml.contracts import METRICS, ContractError

# column -> (unit the model expects, direction a decline moves it)
GAIT = {
    "walking_speed": ("m/s", -1),
    "step_length": ("cm", -1),
    "walking_asymmetry": ("%", 1),
    "double_support": ("%", 1),
    "walking_steadiness": ("%", -1),
    "steps": ("count", -1),
}
PROGRAMS = ("stroke_rehabilitation", "joint_replacement_recovery")
EFFECT_SIZES = (1.0, 1.5, 2.0, 3.0)
STRIDE_DAYS = 45
WATCH_DAYS = 7
HISTORY_DAYS = 120
ALARM_STATES = ("context_needed", "review_recommended")


def load(path):
    with open(path, encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    first = rows[0]["patient_id"]
    rows = [r for r in rows if r["patient_id"] == first]
    rows.sort(key=lambda r: r["date"])
    return rows


def spread(rows, onset):
    """Each gait signal's own sd over the history window before the onset."""
    out = {}
    lo = max(0, onset - HISTORY_DAYS)
    for signal, (_, direction) in GAIT.items():
        before = [v for i, v in series(rows, signal) if lo <= i < onset]
        if len(before) >= MIN_OBSERVATIONS:
            sd = statistics.pstdev(before)
            if sd > 0:
                out[signal] = direction * sd
    return out


def inject(rows, onset, effect, step):
    out = []
    for i, row in enumerate(rows):
        copy = dict(row)
        if i >= onset:
            ramp = min(1.0, (i - onset + 1) / RAMP_DAYS)
            for signal, unit_step in step.items():
                if copy.get(signal):
                    try:
                        copy[signal] = str(clamp(signal, float(copy[signal]) + unit_step * effect * ramp))
                    except ValueError:
                        pass
        out.append(copy)
    return out


def clamp(signal, value):
    """Keep an injected value inside the contract's own range for that metric.

    A decline of three personal standard deviations in daily steps can take
    the number below zero, which no phone will ever report and which the
    contract rightly rejects. Left unclamped, the rejection was swallowed and
    counted as "the model did not speak", so detection appeared to fall as
    the injected change grew. The injection saturates at the bound instead.
    """
    m = METRICS[signal]
    span = m.hi - m.lo
    return min(m.hi, max(m.lo + span * 1e-6, value))


def rule_lag(rows, onset):
    lo = max(0, onset - HISTORY_DAYS)
    values = {s: {i: v for i, v in series(rows, s) if i >= lo} for s in GAIT}
    values = {s: d for s, d in values.items() if len([i for i in d if i < onset]) >= MIN_OBSERVATIONS}
    if len(values) < MIN_SIGNALS:
        return None
    for day in range(onset, min(onset + WATCH_DAYS + 1, len(rows))):
        if fires_on(values, day, THRESHOLD_SD, MIN_SIGNALS):
            return day - onset
    return None


def events(rows, lo, hi):
    out = []
    for row in rows[lo:hi]:
        for signal, (unit, _) in GAIT.items():
            raw = row.get(signal, "")
            if not raw:
                continue
            try:
                value = round(float(raw), 3)
            except ValueError:
                continue
            out.append({"metric": signal, "value": value, "unit": unit,
                        "timestamp": f"{row['date']}T12:00:00Z", "source": "phone"})
    out.sort(key=lambda e: (e["timestamp"], e["metric"]))
    return out


def model_lag(rows, onset, program):
    from vesper_ml.score import score_request

    lo = max(0, onset - HISTORY_DAYS)
    for day in range(onset, min(onset + WATCH_DAYS + 1, len(rows))):
        ev = events(rows, lo, day + 1)
        if len(ev) < 40:
            continue
        try:
            result = score_request({"program": program, "events": ev, "patient_id": rows[0]["patient_id"],
                                    "seed": 0, "analyzedThrough": f"{rows[day]['date']}T23:59:59Z"})
        except ContractError:
            # Counted and reported, never silently taken as "no alarm": that
            # is how a rejected episode hid inside a detection rate once.
            REJECTED.append((program, onset, day - onset))
            continue
        if result["application_state"] in ALARM_STATES:
            return day - onset
    return None


REJECTED = []


def onsets(rows):
    return [o for o in range(HISTORY_DAYS, len(rows) - WATCH_DAYS, STRIDE_DAYS)
            if len(spread(rows, o)) >= MIN_SIGNALS]


def run(rows, starts, effect, program):
    rule, model = [], []
    for onset in starts:
        data = inject(rows, onset, effect, spread(rows, onset)) if effect else rows
        rule.append(rule_lag(data, onset))
        model.append(model_lag(data, onset, program))
    n = len(starts)
    pct = lambda xs: round(100 * sum(x is not None for x in xs) / n, 1) if n else None
    med = lambda xs: (lambda v: round(statistics.median(v), 1) if v else None)([x for x in xs if x is not None])
    return {"effect_sd": effect, "episodes": n,
            "rule_detection_pct": pct(rule), "rule_median_lag_days": med(rule),
            "model_detection_pct": pct(model), "model_median_lag_days": med(model)}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("infile", nargs="?", default="fixtures/daily_deid.csv")
    parser.add_argument("--json", help="also write the result here")
    args = parser.parse_args()
    try:
        import vesper_ml.score  # noqa: F401
    except ImportError as exc:
        sys.exit(f"cannot import the engine ({exc}). Run with PYTHONPATH=ml and numpy/scikit-learn installed.")

    rows = load(args.infile)
    starts = onsets(rows)
    print(f"one de-identified subject, {len(rows)} days; {len(starts)} episodes, one every {STRIDE_DAYS} days,")
    print(f"each with {HISTORY_DAYS} days of history and {WATCH_DAYS} days to speak\n")
    payload = {"subject_days": len(rows), "episodes": len(starts), "stride_days": STRIDE_DAYS,
               "history_days": HISTORY_DAYS, "watch_days": WATCH_DAYS, "ramp_days": RAMP_DAYS,
               "injected": {s: d for s, (_, d) in GAIT.items()}, "programs": {}}
    cell = lambda r: (f"{str(r['rule_detection_pct']) + '%':>13}"
                      f"{(str(r['rule_median_lag_days']) + 'd' if r['rule_median_lag_days'] is not None else '—'):>10}"
                      f"{str(r['model_detection_pct']) + '%':>14}"
                      f"{(str(r['model_median_lag_days']) + 'd' if r['model_median_lag_days'] is not None else '—'):>11}")
    for program in PROGRAMS:
        control = run(rows, starts, 0.0, program)
        results = [run(rows, starts, e, program) for e in EFFECT_SIZES]
        payload["programs"][program] = {"control": control, "results": results}
        print(f"program: {program}")
        print(f"  {'injected':>10}{'rule caught':>13}{'rule lag':>10}{'model caught':>14}{'model lag':>11}")
        print(f"  {'nothing':>10}{cell(control)}")
        for r in results:
            print(f"  {str(r['effect_sd']) + ' sd':>10}{cell(r)}")
        print()
    payload["contract_rejections"] = len(REJECTED)
    print(f"scoring days rejected by the contract: {len(REJECTED)}"
          + ("" if not REJECTED else "  <-- these episodes are NOT counted as misses; investigate"))
    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
        print(f"wrote {args.json}")


if __name__ == "__main__":
    main()
