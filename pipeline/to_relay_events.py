"""De-identified daily aggregates -> the shared engine's event contract.

`shared/engine.js` on the MVP branch validates strictly: known metric, unit
match, RFC3339 timestamp with offset, positive finite value, non-empty source,
no duplicate metric+timestamp, 1-10,000 records. This emits exactly that shape
so real wearable data can be replayed through the same engine the synthetic
patients use.

Metrics the engine knows: rhr, hrv, respiratory, sleep, glucose, spo2.
Anything else we measure (nocturnal heart rate, step count) has no home in the
contract and is dropped here rather than silently renamed.

Usage:
    python3 pipeline/to_relay_events.py data/daily_deid.csv data/relay_events.json
"""
import csv
import json
import sys

# column -> (engine metric, engine unit). Units must match METRICS exactly or
# normalize() rejects the record.
CONTRACT = {
    "resting_heart_rate": ("rhr", "bpm"),
    "hrv_sdnn": ("hrv", "ms"),
    "respiratory_rate": ("respiratory", "/min"),
    "spo2": ("spo2", "%"),
    "sleep_hours": ("sleep", "h"),
}

# No CGM in the source data. The engine treats a missing metric as insufficient
# baseline rather than an error, which is the correct behaviour here.
UNSUPPORTED = {"hr_night", "steps", "active_energy"}

MAX_RECORDS = 10000
SOURCE = "Wearable daily aggregate"


def convert(rows, hour="12:00:00"):
    events = []
    for row in rows:
        # Days with no wearable samples carry only phone-derived activity and
        # would contribute a misleading baseline point.
        if not row.get("hr_samples") or row["hr_samples"] in ("0", ""):
            continue
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
                "metric": metric,
                "value": value,
                "unit": unit,
                "timestamp": f"{row['date']}T{hour}Z",
                "source": SOURCE,
            })
    events.sort(key=lambda e: (e["timestamp"], e["metric"]))
    return events


def main():
    infile = sys.argv[1] if len(sys.argv) > 1 else "data/daily_deid.csv"
    outfile = sys.argv[2] if len(sys.argv) > 2 else "data/relay_events.json"
    with open(infile, encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    events = convert(rows)
    if len(events) > MAX_RECORDS:
        # Keep the most recent, which is the window the engine analyzes anyway.
        events = events[-MAX_RECORDS:]
        print(f"note: truncated to the most recent {MAX_RECORDS} records")

    with open(outfile, "w", encoding="utf-8") as handle:
        json.dump(events, handle, indent=2)

    days = len({e["timestamp"][:10] for e in events})
    counts = {}
    for event in events:
        counts[event["metric"]] = counts.get(event["metric"], 0) + 1
    print(f"{outfile}: {len(events)} events across {days} days")
    for metric, n in sorted(counts.items(), key=lambda kv: -kv[1]):
        print(f"  {metric:<14}{n:>5} days")
    print(f"  dropped (not in contract): {', '.join(sorted(UNSUPPORTED))}")


if __name__ == "__main__":
    main()
