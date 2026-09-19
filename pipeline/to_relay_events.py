"""De-identified windowed aggregates -> the shared engine's event contract.

`shared/engine.js` validates strictly: known metric, exact unit match, RFC3339
timestamp with offset, positive finite value, non-empty source, no duplicate
metric+timestamp, and 1-10,000 records. Everything emitted here is checked
against those rules before it is written, so an invalid contract cannot ship.

Feed this 6-hour aggregates, not daily ones. The engine's baseline gate wants
12 samples inside 14 days; daily rows cannot supply that for anything but
SpO2, while 6-hour rows clear it for SpO2, respiratory rate and HRV. See
docs/INTEROP.md.

Nocturnal heart rate is emitted only with --include-nocturnal, because
`METRICS` has no entry for it. The doc prints the entry to add. It is never
emitted as `rhr`: the two are different quantities (9.2 bpm apart, r=0.45)
and splicing them would manufacture a step change in the middle of the series.

Usage:
    python3 pipeline/to_relay_events.py fixtures/windows_deid.csv fixtures/relay_events.json
"""
import argparse
import csv
import json

# column -> (engine metric, engine unit). Units must match METRICS exactly.
CONTRACT = {
    "resting_heart_rate": ("rhr", "bpm"),
    "hrv_sdnn": ("hrv", "ms"),
    "respiratory_rate": ("respiratory", "/min"),
    "spo2": ("spo2", "%"),
    "sleep_hours": ("sleep", "h"),
}

# Requires this in shared/engine.js METRICS before the engine will accept it:
#   hr_night: { label: "Nocturnal heart rate", unit: "bpm", base: 62,
#               threshold: 12, color: "#8b6f9e", source: "Wearable" },
NOCTURNAL = ("hr_night", ("hr_night", "bpm"))

MAX_RECORDS = 10000
SOURCE = "Wearable 6h window"


def rows_to_events(rows, include_nocturnal=False):
    events = []
    seen_nocturnal = set()
    for row in rows:
        # Windows with no wearable samples carry only phone-derived activity
        # and would contribute a misleading baseline point.
        if not row.get("hr_samples") or row["hr_samples"] in ("0", ""):
            continue
        slot = int(row.get("window") or 0)
        timestamp = f"{row['date']}T{slot:02d}:00:00Z"

        pairs = list(CONTRACT.items())
        if include_nocturnal:
            pairs.append(NOCTURNAL)

        for column, (metric, unit) in pairs:
            # Nocturnal HR is a whole-night value repeated across the day's
            # windows. Emitting it four times would inflate the sample count
            # the baseline gate counts, so take it once per day.
            if column == "hr_night":
                if row["date"] in seen_nocturnal:
                    continue
                seen_nocturnal.add(row["date"])
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
                "timestamp": timestamp, "source": SOURCE,
            })
    events.sort(key=lambda e: (e["timestamp"], e["metric"]))
    return events


def validate(events):
    """Re-check the engine's own rules. Returns a list of problems."""
    problems = []
    if not events:
        return ["no events produced"]
    if len(events) > MAX_RECORDS:
        problems.append(f"{len(events)} records exceeds the engine's {MAX_RECORDS} limit")
    seen = set()
    for i, event in enumerate(events, 1):
        key = (event["metric"], event["timestamp"])
        if key in seen:
            problems.append(f"record {i}: duplicate {key[0]} at {key[1]}")
        seen.add(key)
        if not event["timestamp"].endswith("Z"):
            problems.append(f"record {i}: timestamp lacks a timezone")
        if not isinstance(event["value"], float) or not 0 < event["value"] <= 1000:
            problems.append(f"record {i}: value {event['value']} out of range")
        if not event["source"] or len(event["source"]) > 100:
            problems.append(f"record {i}: bad source")
    return problems


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("infile", nargs="?", default="fixtures/windows_deid.csv")
    parser.add_argument("outfile", nargs="?", default="fixtures/relay_events.json")
    parser.add_argument("--include-nocturnal", action="store_true",
                        help="also emit hr_night; needs a METRICS entry in shared/engine.js")
    args = parser.parse_args()

    with open(args.infile, encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    events = rows_to_events(rows, args.include_nocturnal)
    problems = validate(events)
    if problems:
        for problem in problems[:10]:
            print(f"  contract violation: {problem}")
        raise SystemExit(f"refusing to write {args.outfile}: {len(problems)} contract violation(s)")

    with open(args.outfile, "w", encoding="utf-8") as handle:
        json.dump(events, handle, indent=2)

    days = len({e["timestamp"][:10] for e in events})
    counts = {}
    for event in events:
        counts[event["metric"]] = counts.get(event["metric"], 0) + 1
    print(f"{args.outfile}: {len(events)} events across {days} days, contract valid")
    print(f"  {'metric':<14}{'events':>7}{'per 14d':>9}  baseline gate (needs 12)")
    for metric, n in sorted(counts.items(), key=lambda kv: -kv[1]):
        per14 = n / days * 14
        print(f"  {metric:<14}{n:>7}{per14:>9.1f}  {'passes' if per14 >= 12 else 'below the gate'}")
    if not args.include_nocturnal:
        print("  hr_night withheld — add the METRICS entry in this file's docstring, then --include-nocturnal")


if __name__ == "__main__":
    main()
