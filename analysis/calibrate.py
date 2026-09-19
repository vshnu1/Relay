"""How often does the rule fire on people who are not deteriorating?

This is the first question a clinical judge asks and the one we currently
cannot answer. Run over a cohort of ordinary people, the fire rate is a
false-positive proxy: nobody in LifeSnaps is post-surgical, so essentially
every trigger is a false alarm.

Also produces the population-spread figures, which are the empirical case for
the whole product: if 71 people's resting heart rates sit 30 bpm apart, no
single threshold can serve them and a personal baseline is not a nicety.

Usage:
    python3 analysis/calibrate.py fixtures/lifesnaps_daily.csv
    python3 analysis/calibrate.py fixtures/lifesnaps_daily.csv --sweep --json out.json
"""
import argparse
import csv
import json
import statistics
from collections import defaultdict

from baseline import MIN_OBSERVATIONS
from detect import SIGNALS, THRESHOLD_SD

# Taken from detect.py rather than restated, so this tool always measures the
# setting the product actually ships. They were allowed to drift apart once:
# the rule moved to 1.75 and the measurement kept reporting 1.5.
DEFAULT_SD = THRESHOLD_SD
DEFAULT_MIN_SIGNALS = 2


def by_subject(path):
    subjects = defaultdict(list)
    with open(path, encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            subjects[row.get("patient_id", "unknown")].append(row)
    for rows in subjects.values():
        rows.sort(key=lambda r: r["date"])
    return subjects


def numeric(rows, signal):
    out = []
    for row in rows:
        raw = row.get(signal, "")
        if raw not in ("", None):
            try:
                out.append(float(raw))
            except ValueError:
                pass
    return out


def fire_rate(rows, threshold_sd, min_signals):
    """Days where >= min_signals exceed threshold_sd of this subject's own baseline."""
    stats = {}
    for signal in SIGNALS:
        values = numeric(rows, signal)
        if len(values) >= MIN_OBSERVATIONS:
            sd = statistics.pstdev(values)
            if sd > 0:
                stats[signal] = (statistics.mean(values), sd)
    if not stats:
        return None
    fired = 0
    for row in rows:
        deviating = 0
        for signal, (mean, sd) in stats.items():
            raw = row.get(signal, "")
            if raw in ("", None):
                continue
            try:
                if abs((float(raw) - mean) / sd) >= threshold_sd:
                    deviating += 1
            except ValueError:
                pass
        fired += deviating >= min_signals
    return fired, len(rows), stats


def trailing_fire_rate(rows, threshold_sd, min_signals):
    """The same rule, but judging each day only against the days before it.

    fire_rate above builds one baseline from the subject's whole series and
    tests every day against it, including the day itself and every later day.
    That is hindsight a deployment does not have: detect.py builds the
    baseline from history before the day under test. The difference is not
    small, so both are reported rather than one standing for the other.
    """
    values = {}
    for signal in SIGNALS:
        points = numeric(rows, signal)
        if len(points) >= MIN_OBSERVATIONS:
            values[signal] = {
                i: v
                for i, v in zip(
                    [i for i, row in enumerate(rows) if row.get(signal) not in ("", None)],
                    points,
                )
            }
    if not values:
        return None
    fired = judged = 0
    for day in range(len(rows)):
        deviating = 0
        scored = False
        for by_day in values.values():
            if day not in by_day:
                continue
            history = [v for i, v in by_day.items() if i < day]
            if len(history) < MIN_OBSERVATIONS:
                continue
            sd = statistics.pstdev(history)
            if sd == 0:
                continue
            scored = True
            if abs((by_day[day] - statistics.mean(history)) / sd) >= threshold_sd:
                deviating += 1
        if scored:
            judged += 1
            fired += deviating >= min_signals
    return (fired, judged, values) if judged else None


def run(subjects, threshold_sd, min_signals, trailing=False):
    fired = days = usable = 0
    measure = trailing_fire_rate if trailing else fire_rate
    for rows in subjects.values():
        result = measure(rows, threshold_sd, min_signals)
        if result is None:
            continue
        f, n, _ = result
        fired += f
        days += n
        usable += 1
    return {"threshold_sd": threshold_sd, "min_signals": min_signals,
            "baseline": "trailing" if trailing else "whole-series",
            "subjects": usable, "subject_days": days, "fired": fired,
            "rate_pct": round(100 * fired / days, 2) if days else None}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("infile", nargs="?", default="fixtures/lifesnaps_daily.csv")
    parser.add_argument("--sweep", action="store_true", help="scan thresholds instead of one setting")
    parser.add_argument("--json", help="also write results here")
    args = parser.parse_args()

    subjects = by_subject(args.infile)
    print(f"{len(subjects)} subjects, {sum(len(v) for v in subjects.values())} subject-days\n")

    # Population spread. This is the figure that justifies personal baselines.
    print("personal baselines across the cohort")
    print(f"  {'signal':<20}{'subjects':>9}{'lowest':>9}{'highest':>9}{'spread':>9}{'within-person sd':>18}")
    spread = {}
    for signal in SIGNALS:
        means, sds = [], []
        for rows in subjects.values():
            values = numeric(rows, signal)
            if len(values) >= MIN_OBSERVATIONS:
                means.append(statistics.mean(values))
                sds.append(statistics.pstdev(values))
        if len(means) < 2:
            continue
        spread[signal] = {"n": len(means), "min": round(min(means), 1), "max": round(max(means), 1),
                          "between_sd": round(statistics.pstdev(means), 2),
                          "within_sd": round(statistics.mean(sds), 2)}
        s = spread[signal]
        print(f"  {signal:<20}{s['n']:>9}{s['min']:>9}{s['max']:>9}{s['max']-s['min']:>9.1f}{s['within_sd']:>18}")
    print("\n  Spread between people vs variation within one person is the whole argument:")
    print("  where the first is much larger, a single population threshold cannot work.")

    results = []
    if args.sweep:
        print(f"\nfire rate on a non-deteriorating cohort (every trigger is a false alarm)")
        print(f"  {'sd':>5}{'signals':>9}{'subjects':>10}{'days':>8}{'fired':>8}{'rate':>8}")
        # The grid has to contain the setting the product actually ships, or
        # the number quoted in the README cannot be reproduced from this file.
        # 1.7 and 1.8 bracket it: 1.8 is where the one real coordinated event
        # in our own data stops being caught.
        for sd in (1.0, 1.5, 1.7, DEFAULT_SD, 1.8, 2.0, 2.5, 3.0):
            for ms in (2, 3):
                r = run(subjects, sd, ms)
                results.append(r)
                print(f"  {sd:>5}{ms:>9}{r['subjects']:>10}{r['subject_days']:>8}{r['fired']:>8}{str(r['rate_pct'])+'%':>8}")
    else:
        r = run(subjects, DEFAULT_SD, DEFAULT_MIN_SIGNALS)
        results.append(r)
        print(f"\nat {DEFAULT_SD} sd and {DEFAULT_MIN_SIGNALS}+ signals: fired on {r['fired']} of "
              f"{r['subject_days']} subject-days ({r['rate_pct']}%) across {r['subjects']} subjects")

    trailing = run(subjects, DEFAULT_SD, DEFAULT_MIN_SIGNALS, trailing=True)
    results.append(trailing)
    print(f"\nthe same rule judging each day only against the days before it, which is what"
          f"\ndetect.py does: fired on {trailing['fired']} of {trailing['subject_days']} "
          f"subject-days ({trailing['rate_pct']}%) across {trailing['subjects']} subjects.")
    print("a whole-series baseline includes the day being judged and every later day, so it"
          "\nreads lower than the rule behaves in a deployment.")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump({"population_spread": spread, "fire_rates": results}, handle, indent=2)
        print(f"\nwrote {args.json}")


if __name__ == "__main__":
    main()
