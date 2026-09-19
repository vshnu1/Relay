"""Normalized events -> one row per patient-day.

Daily resolution is the unit the deviation engine reasons about: a "persistent
coordinated deviation" is a statement about days, not about individual samples.

Nocturnal heart rate is averaged over 02:00-06:00 local rather than taken from
the vendor's own resting-HR field, because that field is only present on about
half the days and we want a signal with dense coverage.

Usage:
    python3 pipeline/aggregate.py data/events.csv data/daily.csv
"""
import csv
import statistics
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta

NIGHT_START, NIGHT_END = 2, 6

FIELDS = [
    "date", "resting_heart_rate", "hr_night", "hrv_sdnn", "respiratory_rate",
    "spo2", "steps", "active_energy", "sleep_deep", "sleep_rem", "sleep_core",
    "sleep_awake", "sleep_hours", "hr_samples", "sources",
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


def aggregate(events_path):
    buckets = defaultdict(lambda: defaultdict(list))
    sleep = defaultdict(lambda: defaultdict(int))
    sleep_minutes = defaultdict(lambda: defaultdict(float))
    sources = defaultdict(set)

    with open(events_path, encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            stamp = row["timestamp"]
            day, hour = stamp[:10], int(stamp[11:13])
            signal, raw = row["signal"], row["value"]
            sources[day].add(row["source"])

            if signal == "sleep_stage":
                # Sleep is attributed to the night it belongs to, not the calendar
                # day the sample landed on, so a 03:00 REM block counts correctly.
                # Episodes are counted and their durations summed: the engine
                # contract wants hours asleep, not a count of sleep blocks.
                night = night_of(day, hour)
                sleep[night][raw] += 1
                minutes = duration_minutes(stamp, row.get("end_timestamp", ""))
                if minutes and raw != "InBed":
                    sleep_minutes[night][raw] += minutes
                continue

            try:
                value = float(raw)
            except ValueError:
                continue

            if signal == "heart_rate":
                if NIGHT_START <= hour < NIGHT_END:
                    buckets[day]["hr_night"].append(value)
                buckets[day]["hr_samples"].append(value)
            elif signal == "spo2":
                # HealthKit stores saturation as a 0-1 fraction; report percent.
                buckets[day]["spo2"].append(value * 100 if value <= 1 else value)
            else:
                buckets[day][signal].append(value)

    rows = []
    for day in sorted(set(buckets) | set(sleep)):
        bucket, night = buckets[day], sleep.get(day, {})
        asleep = sleep_minutes.get(day, {})
        mean = lambda key: round(statistics.mean(bucket[key]), 2) if bucket[key] else ""
        rows.append({
            "date": day,
            "resting_heart_rate": mean("resting_heart_rate"),
            "hr_night": mean("hr_night"),
            "hrv_sdnn": mean("hrv_sdnn"),
            "respiratory_rate": mean("respiratory_rate"),
            "spo2": mean("spo2"),
            "steps": int(sum(bucket["steps"])) if bucket["steps"] else "",
            "active_energy": round(sum(bucket["active_energy"]), 1) if bucket["active_energy"] else "",
            "sleep_deep": night.get("AsleepDeep", ""),
            "sleep_rem": night.get("AsleepREM", ""),
            "sleep_core": night.get("AsleepCore", ""),
            "sleep_awake": night.get("Awake", ""),
            "sleep_hours": round(sum(asleep.values()) / 60, 2) if asleep else "",
            "hr_samples": len(bucket["hr_samples"]),
            "sources": "|".join(sorted(sources[day])),
        })
    return rows


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    rows = aggregate(sys.argv[1])
    with open(sys.argv[2], "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"{sys.argv[2]}: {len(rows)} patient-days ({rows[0]['date']} .. {rows[-1]['date']})")


if __name__ == "__main__":
    main()
