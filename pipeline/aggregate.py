"""Normalized events -> one row per patient-window.

Two granularities matter and they serve different consumers:

  --window 24 (default)  one row per patient-day. What analysis/detect.py
                         reasons about, and what "a persistent deviation"
                         means in clinical terms.
  --window 6             four rows per day. The cadence shared/engine.js is
                         tuned for. Its baseline gate wants 12 samples inside
                         14 days, which daily aggregation cannot supply for
                         anything but SpO2 even though the device samples
                         respiratory rate every minute and heart rate
                         continuously. Aggregating to 6h is what makes real
                         data usable by that engine; see docs/INTEROP.md.

Nocturnal heart rate is derived here as the mean over 02:00-06:00 local. It
is NOT a substitute for the vendor's resting-heart-rate field: measured
against it over the 54 days where both exist, the nocturnal mean runs 9.2 bpm
high with a correlation of 0.45 and a mean absolute error of 9.4. Splicing
the two into one series would put a step artifact in the middle of it and
manufacture deviations. They are kept as separate columns with separate
baselines so like is only ever compared with like.

Usage:
    python3 pipeline/aggregate.py data/events.csv data/daily.csv
    python3 pipeline/aggregate.py data/events.csv data/windows.csv --window 6
"""
import argparse
import csv
import statistics
from collections import defaultdict
from datetime import date, datetime, timedelta

NIGHT_START, NIGHT_END = 2, 6

FIELDS = [
    "date", "window", "resting_heart_rate", "hr_night", "hrv_sdnn",
    "respiratory_rate", "spo2", "steps", "active_energy", "sleep_deep",
    "sleep_rem", "sleep_core", "sleep_awake", "sleep_hours", "hr_samples",
    "sources",
]


def duration_minutes(start, end):
    """Minutes between two HealthKit timestamps, or 0 if unparseable."""
    try:
        fmt = "%Y-%m-%d %H:%M:%S %z"
        return max(0.0, (datetime.strptime(end, fmt) - datetime.strptime(start, fmt)).total_seconds() / 60)
    except (ValueError, TypeError):
        return 0.0


def night_of(day, hour):
    """Sleep after midnight belongs to the night that started the previous day."""
    return day if hour >= 12 else (date.fromisoformat(day) - timedelta(days=1)).isoformat()


def morning_after(night):
    return (date.fromisoformat(night) + timedelta(days=1)).isoformat()


def aggregate(events_path, window_hours=24):
    buckets = defaultdict(lambda: defaultdict(list))
    sleep_stages = defaultdict(lambda: defaultdict(int))
    sleep_minutes = defaultdict(lambda: defaultdict(float))
    sources = defaultdict(set)
    nocturnal = defaultdict(list)

    with open(events_path, encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            stamp = row["timestamp"]
            day, hour = stamp[:10], int(stamp[11:13])
            signal, raw = row["signal"], row["value"]
            slot = hour // window_hours * window_hours
            key = (day, slot)
            sources[key].add(row["source"])

            if signal == "sleep_stage":
                night = night_of(day, hour)
                sleep_stages[night][raw] += 1
                minutes = duration_minutes(stamp, row.get("end_timestamp", ""))
                if minutes and raw != "InBed":
                    sleep_minutes[night][raw] += minutes
                continue

            try:
                value = float(raw)
            except ValueError:
                continue

            if signal == "heart_rate":
                # Nocturnal mean is a whole-night property, so it is keyed by
                # day and written into every window of that day rather than
                # recomputed per six-hour slot.
                if NIGHT_START <= hour < NIGHT_END:
                    nocturnal[day].append(value)
                buckets[key]["hr_samples"].append(value)
            elif signal == "spo2":
                # HealthKit stores saturation as a 0-1 fraction; report percent.
                buckets[key]["spo2"].append(value * 100 if value <= 1 else value)
            else:
                buckets[key][signal].append(value)

    # Sleep is one value per night. At daily granularity it belongs to the
    # night's own row; at finer granularity it lands in the first window of
    # the morning after, which is when the figure becomes known.
    sleep_rows = {}
    for night, stages in sleep_stages.items():
        target = (night, 0) if window_hours >= 24 else (morning_after(night), 0)
        sleep_rows[target] = (stages, sleep_minutes.get(night, {}))

    rows = []
    for key in sorted(set(buckets) | set(sleep_rows)):
        day, slot = key
        bucket = buckets[key]
        stages, asleep = sleep_rows.get(key, ({}, {}))
        mean = lambda name: round(statistics.mean(bucket[name]), 2) if bucket[name] else ""
        night_values = nocturnal.get(day, [])
        rows.append({
            "date": day,
            "window": slot,
            "resting_heart_rate": mean("resting_heart_rate"),
            "hr_night": round(statistics.mean(night_values), 2) if night_values else "",
            "hrv_sdnn": mean("hrv_sdnn"),
            "respiratory_rate": mean("respiratory_rate"),
            "spo2": mean("spo2"),
            "steps": int(sum(bucket["steps"])) if bucket["steps"] else "",
            "active_energy": round(sum(bucket["active_energy"]), 1) if bucket["active_energy"] else "",
            "sleep_deep": stages.get("AsleepDeep", ""),
            "sleep_rem": stages.get("AsleepREM", ""),
            "sleep_core": stages.get("AsleepCore", ""),
            "sleep_awake": stages.get("Awake", ""),
            "sleep_hours": round(sum(asleep.values()) / 60, 2) if asleep else "",
            "hr_samples": len(bucket["hr_samples"]),
            "sources": "|".join(sorted(sources.get(key, ()))),
        })
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("infile")
    parser.add_argument("outfile")
    parser.add_argument("--window", type=int, default=24, choices=[1, 2, 3, 4, 6, 8, 12, 24],
                        help="hours per row; must divide 24 (default 24)")
    args = parser.parse_args()

    rows = aggregate(args.infile, args.window)
    with open(args.outfile, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    days = len({r["date"] for r in rows})
    print(f"{args.outfile}: {len(rows)} rows over {days} days "
          f"({args.window}h windows, {rows[0]['date']} .. {rows[-1]['date']})")


if __name__ == "__main__":
    main()
