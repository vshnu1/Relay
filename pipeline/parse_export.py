"""Apple Health XML -> normalized event stream.

This is the ingest half of the "API + normalized event store" box in the
architecture doc. Every device source lands on one schema and one time axis
so downstream stages never care which vendor produced a sample.

Usage:
    python3 pipeline/parse_export.py data/raw/apple_health_export/export.xml data/events.csv
"""
import csv
import re
import sys

# Only the signals the deviation engine consumes. Everything else in the
# export is noise for our purposes and parsing it costs minutes on a 284MB file.
SIGNALS = {
    "HeartRate": "heart_rate",
    "RestingHeartRate": "resting_heart_rate",
    "HeartRateVariabilitySDNN": "hrv_sdnn",
    "RespiratoryRate": "respiratory_rate",
    "OxygenSaturation": "spo2",
    "StepCount": "steps",
    "ActiveEnergyBurned": "active_energy",
    "SleepAnalysis": "sleep_stage",
}

RECORD = re.compile(
    r'<Record type="HK\w*?Identifier(?P<type>\w+)"'
    r'(?:[^>]*?unit="(?P<unit>[^"]*)")?'
    r'[^>]*?sourceName="(?P<source>[^"]*)"'
    r'[^>]*?startDate="(?P<start>[^"]*)"'
    r'[^>]*?endDate="(?P<end>[^"]*)"'
    r'[^>]*?value="(?P<value>[^"]*)"'
)

FIELDS = ["timestamp", "end_timestamp", "signal", "value", "unit", "source"]


def parse(xml_path):
    """Yield one normalized dict per relevant record. Streams; never loads the file."""
    with open(xml_path, encoding="utf-8", errors="replace") as handle:
        for line in handle:
            if "<Record " not in line:
                continue
            match = RECORD.search(line)
            if not match:
                continue
            signal = SIGNALS.get(match.group("type"))
            if signal is None:
                continue
            value = match.group("value")
            if signal == "sleep_stage":
                value = value.replace("HKCategoryValueSleepAnalysis", "")
            yield {
                "timestamp": match.group("start"),
                "end_timestamp": match.group("end"),
                "signal": signal,
                "value": value,
                "unit": match.group("unit") or "",
                "source": match.group("source"),
            }


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    xml_path, out_path = sys.argv[1], sys.argv[2]
    counts = {}
    with open(out_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for event in parse(xml_path):
            writer.writerow(event)
            counts[event["signal"]] = counts.get(event["signal"], 0) + 1
    total = sum(counts.values())
    print(f"{out_path}: {total} events")
    for signal, n in sorted(counts.items(), key=lambda kv: -kv[1]):
        print(f"  {signal:<22}{n:>8}")


if __name__ == "__main__":
    main()
