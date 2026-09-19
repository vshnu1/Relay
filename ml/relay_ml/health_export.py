"""Streaming Apple Health export reader.

Reads `export.xml` only from an explicit path or the HEALTH_EXPORT_XML
environment variable. Emits six-hour aggregates in the shared event contract
with the source collapsed to a generic category (wearable, phone, manual,
unknown). Device names, metadata, and raw observations never leave this
module; the summary it returns holds counts, coverage, and timings only.

Duplicate-source policy: for each metric, the single source (by raw name,
in memory only) contributing the most records is kept and every other source
is dropped, so simultaneous records from two devices are never averaged.
"""

import os
import time
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime

from .contracts import epoch_ms, from_epoch_ms, to_iso
from .metrics import METRICS

ENV_VAR = "HEALTH_EXPORT_XML"
WINDOW_MS = 6 * 3_600_000

# HK type suffix -> (metric, accepted units -> multiplier to the metric unit)
QUANTITY_TYPES = {
    "HeartRate": ("heart_rate", {"count/min": 1.0}),
    "RestingHeartRate": ("rhr", {"count/min": 1.0}),
    "HeartRateVariabilitySDNN": ("hrv", {"ms": 1.0}),
    "RespiratoryRate": ("respiratory", {"count/min": 1.0}),
    "OxygenSaturation": ("spo2", {"%": 100.0}),  # exported as a 0-1 fraction
    "StepCount": ("steps", {"count": 1.0}),
    "WalkingSpeed": ("walking_speed", {"m/s": 1.0, "km/hr": 1 / 3.6, "mi/hr": 0.44704}),
    "WalkingStepLength": ("step_length", {"cm": 1.0, "in": 2.54, "m": 100.0}),
    "WalkingAsymmetryPercentage": ("walking_asymmetry", {"%": 1.0}),
    "WalkingDoubleSupportPercentage": ("double_support", {"%": 1.0}),
    "AppleWalkingSteadiness": ("walking_steadiness", {"%": 1.0}),
    "BodyTemperature": ("temperature", {"degC": 1.0}),
    "BodyMass": ("weight", {"kg": 1.0, "lb": 0.45359237}),
    "BloodPressureSystolic": ("systolic_bp", {"mmHg": 1.0}),
    "BloodPressureDiastolic": ("diastolic_bp", {"mmHg": 1.0}),
    "BloodGlucose": ("glucose", {"mg/dL": 1.0}),
}
SLEEP_TYPE = "SleepAnalysis"
ASLEEP_VALUES = {"AsleepCore", "AsleepDeep", "AsleepREM", "AsleepUnspecified", "Asleep"}
SUM_METRICS = {"steps", "sleep"}
# Percent metrics Apple may export as 0-1 fractions; rescaled when every value <= 1.
FRACTION_PERCENT_METRICS = {"walking_asymmetry", "double_support", "walking_steadiness"}

_WEARABLE = ("watch", "strap", "band", "whoop", "zepp", "garmin", "fitbit", "oura", "ring", "polar", "amazfit")
_PHONE = ("iphone", "phone")
_MANUAL = ("health", "manual", "clue", "mysugr", "glooko")


def source_category(source_name, user_entered=False):
    if user_entered:
        return "manual"
    s = (source_name or "").lower()
    if any(k in s for k in _WEARABLE):
        return "wearable"
    if any(k in s for k in _PHONE):
        return "phone"
    if any(k in s for k in _MANUAL):
        return "manual"
    return "unknown"


def resolve_path(explicit=None):
    path = explicit or os.environ.get(ENV_VAR)
    if not path:
        raise FileNotFoundError(f"Set {ENV_VAR} or pass an explicit export path.")
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Export not found at the configured path ({ENV_VAR}).")
    return path


def _parse_hk_time(s):
    return epoch_ms(datetime.strptime(s, "%Y-%m-%d %H:%M:%S %z"))


def read_export(path_or_stream, max_records=None):
    """Return (events, summary). Streams the XML; keeps only per-window sums.

    `path_or_stream` may be a filesystem path or a binary file object (tests).
    """
    t0 = time.perf_counter()
    # (metric, source_name) -> {window_start_ms: [sum, count]}
    acc = defaultdict(lambda: defaultdict(lambda: [0.0, 0]))
    per_source_count = defaultdict(Counter)  # metric -> Counter(source_name)
    category_of = {}  # source_name -> category (in memory only)
    seen = Counter()
    dropped = Counter()
    n = 0
    for _, node in ET.iterparse(path_or_stream, events=("end",)):
        if node.tag != "Record":
            if node.tag not in ("MetadataEntry", "HeartRateVariabilityMetadataList", "InstantaneousBeatsPerMinute"):
                node.clear()
            continue
        n += 1
        if max_records and n > max_records:
            node.clear()
            break
        hk_type = (node.get("type") or "").replace("HKQuantityTypeIdentifier", "").replace("HKCategoryTypeIdentifier", "")
        src = node.get("sourceName") or ""
        if src not in category_of:
            user_entered = any(
                m.get("key") == "HKWasUserEntered" and m.get("value") == "1" for m in node.findall("MetadataEntry")
            )
            category_of[src] = source_category(src, user_entered)
        try:
            if hk_type == SLEEP_TYPE:
                val = (node.get("value") or "").replace("HKCategoryValueSleepAnalysis", "")
                if val not in ASLEEP_VALUES:
                    dropped["sleep_non_asleep"] += 1
                    node.clear()
                    continue
                start = _parse_hk_time(node.get("startDate"))
                end = _parse_hk_time(node.get("endDate"))
                hours = max(0.0, (end - start) / 3_600_000)
                window = (end // WINDOW_MS) * WINDOW_MS  # attribute to the window containing the end
                cell = acc[("sleep", src)][window]
                cell[0] += hours
                cell[1] += 1
                per_source_count["sleep"][src] += 1
                seen["sleep"] += 1
            elif hk_type in QUANTITY_TYPES:
                metric, units = QUANTITY_TYPES[hk_type]
                unit = node.get("unit") or ""
                if unit not in units:
                    dropped[f"{metric}_unit"] += 1
                    node.clear()
                    continue
                value = float(node.get("value")) * units[unit]
                start = _parse_hk_time(node.get("startDate"))
                window = (start // WINDOW_MS) * WINDOW_MS
                cell = acc[(metric, src)][window]
                cell[0] += value
                cell[1] += 1
                per_source_count[metric][src] += 1
                seen[metric] += 1
            else:
                dropped["other_type"] += 1
        except (TypeError, ValueError):
            dropped["unparseable"] += 1
        node.clear()
    parse_s = time.perf_counter() - t0

    events = []
    chosen_category = {}
    dropped_sources = Counter()
    for metric, counter in per_source_count.items():
        best_src, _ = counter.most_common(1)[0]
        dropped_sources[metric] = len(counter) - 1
        chosen_category[metric] = category_of.get(best_src, "unknown")
        cells = acc[(metric, best_src)]
        m = METRICS[metric]
        values = {}
        for window, (total, count) in cells.items():
            values[window] = total if metric in SUM_METRICS else total / count
        if metric in FRACTION_PERCENT_METRICS and values and max(values.values()) <= 1.0:
            values = {w: v * 100.0 for w, v in values.items()}
            dropped[f"{metric}_rescaled_fraction"] = 1
        for window, v in sorted(values.items()):
            # window start is the timestamp; the aggregate covers [start, start + 6h)
            if not (m.lo < v <= m.hi):
                dropped[f"{metric}_out_of_range"] += 1
                continue
            events.append(
                {
                    "metric": metric,
                    "value": round(v, 3),
                    "unit": m.unit,
                    "timestamp": to_iso(from_epoch_ms(window)),
                    "source": chosen_category[metric],
                }
            )
    events.sort(key=lambda e: (e["timestamp"], e["metric"]))

    summary = {
        "records_scanned": n,
        "records_used_by_metric": dict(sorted(seen.items())),
        "windows_by_metric": dict(sorted(Counter(e["metric"] for e in events).items())),
        "active_days_by_metric": _active_days(events),
        "coverage_months": _coverage_months(events),
        "source_categories": dict(sorted(Counter(chosen_category.values()).items())),
        "alternate_sources_dropped_by_metric": dict(sorted(dropped_sources.items())),
        "dropped": dict(sorted(dropped.items())),
        "parse_seconds": round(parse_s, 2),
        "events_emitted": len(events),
    }
    return events, summary


def _active_days(events):
    days = defaultdict(set)
    for e in events:
        days[e["metric"]].add(e["timestamp"][:10])
    return {m: len(d) for m, d in sorted(days.items())}


def _coverage_months(events):
    out = {}
    by_metric = defaultdict(list)
    for e in events:
        by_metric[e["metric"]].append(e["timestamp"][:7])
    for m, months in sorted(by_metric.items()):
        out[m] = {"first_month": min(months), "last_month": max(months)}
    return out
