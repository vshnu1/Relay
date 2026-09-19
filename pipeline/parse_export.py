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
    # Gait, from the phone. Named exactly as the model's metrics so the daily
    # rows convert to model events without a second mapping table.
    "WalkingSpeed": "walking_speed",
    "WalkingStepLength": "step_length",
    "WalkingAsymmetryPercentage": "walking_asymmetry",
    "WalkingDoubleSupportPercentage": "double_support",
    "AppleWalkingSteadiness": "walking_steadiness",
}

RECORD = re.compile(
    r'<Record type="HK\w*?Identifier(?P<type>\w+)"'
    r'(?:[^>]*?unit="(?P<unit>[^"]*)")?'
    r'[^>]*?sourceName="(?P<source>[^"]*)"'
    r'[^>]*?startDate="(?P<start>[^"]*)"'
    r'[^>]*?endDate="(?P<end>[^"]*)"'
    r'[^>]*?value="(?P<value>[^"]*)"'
)

# HealthKit writes unit after sourceName and device, so an optional group placed
# before sourceName in RECORD never captured it; every event carried an empty
# unit and nothing noticed until gait, whose values need converting. Found on
# its own, wherever it sits in the tag.
UNIT = re.compile(r'\bunit="(?P<unit>[^"]*)"')

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
            unit = UNIT.search(line)
            if signal == "sleep_stage":
                value = value.replace("HKCategoryValueSleepAnalysis", "")
            yield {
                "timestamp": match.group("start"),
                "end_timestamp": match.group("end"),
                "signal": signal,
                "value": value,
                "unit": unit.group("unit") if unit else "",
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
