"""Per-patient, per-signal baselines.

The whole product rests on comparing a person to themselves rather than to a
population threshold. A resting heart rate of 78 is unremarkable in general and
a 3.6 sd event for this particular patient; only the second framing is useful.

Baselines are computed on a trailing window that excludes the day under test,
so a large deviation cannot inflate the baseline it is being measured against.

Usage:
    python3 analysis/baseline.py data/daily_deid.csv
"""
import csv
import statistics
import sys

SIGNALS = ["resting_heart_rate", "hr_night", "hrv_sdnn", "respiratory_rate", "spo2"]

# A baseline built from a handful of points is not a baseline. Below this the
# signal is reported as insufficient rather than silently trusted.
MIN_OBSERVATIONS = 14


def load(path):
    with open(path, encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def numeric(rows, signal):
    """(index, value) pairs for every row where the signal was actually recorded."""
    out = []
    for i, row in enumerate(rows):
        raw = row.get(signal, "")
        if raw not in ("", None):
            try:
                out.append((i, float(raw)))
            except ValueError:
                pass
    return out


def baselines(rows, signals=SIGNALS, exclude_index=None, window=None):
    """Mean/sd per signal over the observed history.

    exclude_index drops the day under test. window, when set, limits the
    baseline to that many rows before it, which is what makes the baseline
    adapt to genuine long-term change instead of treating it as anomalous.
    """
    result = {}
    for signal in signals:
        points = numeric(rows, signal)
        if exclude_index is not None:
            points = [(i, v) for i, v in points if i != exclude_index]
            if window is not None:
                points = [(i, v) for i, v in points if exclude_index - window <= i < exclude_index]
        values = [v for _, v in points]
        if len(values) < MIN_OBSERVATIONS:
            result[signal] = None
            continue
        sd = statistics.pstdev(values)
        result[signal] = {
            "mean": round(statistics.mean(values), 2),
            "sd": round(sd, 3),
            "n": len(values),
            "usable": sd > 0,
        }
    return result


def main():
    rows = load(sys.argv[1] if len(sys.argv) > 1 else "data/daily_deid.csv")
    print(f"{len(rows)} patient-days\n")
    print(f"{'signal':<22}{'mean':>9}{'sd':>8}{'n':>6}")
    for signal, stats in baselines(rows).items():
        if stats is None:
            print(f"{signal:<22}{'insufficient data':>23}")
        else:
            print(f"{signal:<22}{stats['mean']:>9}{stats['sd']:>8}{stats['n']:>6}")


if __name__ == "__main__":
    main()
