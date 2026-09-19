"""Per-metric population spread, for showing a patient's baseline in context.

A baseline of 64 bpm means nothing on its own. Shown against a cohort that
spans 47 to 78, it makes the product's central claim visible at the moment
someone is looking at the number it justifies: no single threshold serves
both ends of that range.

Source is LifeSnaps — 71 Fitbit Sense wearers over roughly four months,
CC-BY-4.0. Output is keyed by the metric names in ml/relay_ml/metrics.py so
the ML layer can annotate signals without a translation step.

Usage:
    python3 analysis/cohort_baselines.py fixtures/lifesnaps_daily.csv fixtures/cohort_baselines.json
"""
import csv
import json
import statistics
import sys

# our column -> (engine metric key, unit)
MAPPING = {
    "resting_heart_rate": ("rhr", "bpm"),
    "hrv_sdnn": ("hrv", "ms"),
    "respiratory_rate": ("respiratory", "/min"),
    "spo2": ("spo2", "%"),
    "sleep_hours": ("sleep", "h"),
}

# A per-subject baseline needs enough observations to be a baseline at all.
# Matches Program.min_baseline_points on the ML side.
MIN_OBSERVATIONS = 14

SOURCE = {
    "dataset": "LifeSnaps",
    "subjects_enrolled": 71,
    "device": "Fitbit Sense",
    "span": "roughly four months",
    "license": "CC-BY-4.0",
    "url": "https://zenodo.org/records/7229547",
}

CAVEATS = {
    "hrv": "LifeSnaps reports RMSSD; our own export is SDNN. Different measures, "
           "not comparable in absolute terms. Use for spread, never quote as SDNN.",
    "spo2": "Between-subject spread is smaller than within-subject variation here, "
            "so a population threshold is defensible for oxygen saturation and "
            "personal baselining adds least. Thinnest row in the table.",
    "gait": "LifeSnaps carries no gait metrics, so the stroke-rehabilitation "
            "program has no cohort context. Stated rather than interpolated.",
}


def subject_baselines(rows, column):
    """One baseline per subject: the median of their own readings."""
    per_subject = {}
    for row in rows:
        raw = row.get(column, "")
        if raw in ("", None):
            continue
        try:
            per_subject.setdefault(row.get("patient_id", "?"), []).append(float(raw))
        except ValueError:
            pass
    medians, spreads = [], []
    for values in per_subject.values():
        if len(values) < MIN_OBSERVATIONS:
            continue
        medians.append(statistics.median(values))
        spreads.append(statistics.pstdev(values))
    return medians, spreads


def deciles(values):
    """Ten cut points, so a UI can place one patient in the distribution."""
    ordered = sorted(values)
    return [round(ordered[min(len(ordered) - 1, int(len(ordered) * q / 10))], 2) for q in range(11)]


def build(rows):
    out = {}
    for column, (key, unit) in MAPPING.items():
        medians, spreads = subject_baselines(rows, column)
        if len(medians) < 2:
            continue
        between = statistics.pstdev(medians)
        within = statistics.mean(spreads)
        out[key] = {
            "unit": unit,
            "subjects": len(medians),
            "lowest_baseline": round(min(medians), 2),
            "highest_baseline": round(max(medians), 2),
            "spread": round(max(medians) - min(medians), 2),
            "cohort_median": round(statistics.median(medians), 2),
            "between_subject_sd": round(between, 2),
            "within_subject_sd": round(within, 2),
            # Above 1 means people differ from each other more than they vary
            # day to day, which is what makes a personal baseline necessary.
            "spread_ratio": round(between / within, 2) if within else None,
            "deciles": deciles(medians),
        }
        if key in CAVEATS:
            out[key]["caveat"] = CAVEATS[key]
    return out


def main():
    infile = sys.argv[1] if len(sys.argv) > 1 else "fixtures/lifesnaps_daily.csv"
    outfile = sys.argv[2] if len(sys.argv) > 2 else "fixtures/cohort_baselines.json"
    with open(infile, encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    metrics = build(rows)
    payload = {
        "source": SOURCE,
        "subject_days": len(rows),
        "min_observations_per_subject": MIN_OBSERVATIONS,
        "notes": CAVEATS["gait"],
        "metrics": metrics,
    }
    with open(outfile, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)

    print(f"{outfile}: {len(metrics)} metrics from {len(rows)} subject-days\n")
    print(f"  {'metric':<14}{'subj':>6}{'lowest':>9}{'highest':>9}{'spread':>8}{'within':>8}{'ratio':>7}")
    for key, m in metrics.items():
        print(f"  {key:<14}{m['subjects']:>6}{m['lowest_baseline']:>9}{m['highest_baseline']:>9}"
              f"{m['spread']:>8}{m['within_subject_sd']:>8}{str(m['spread_ratio']):>7}")
    print("\n  ratio above 1 = people differ from each other more than they vary day to day")


if __name__ == "__main__":
    main()
