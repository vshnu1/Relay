"""LifeSnaps -> our metric schema, one row per subject-day.

LifeSnaps is 71 Fitbit Sense wearers over ~4 months and carries every signal
Vesper uses. We use it for two things neither our own data nor the synthetic
generator can provide:

  * population spread — how far apart 71 people's personal baselines actually
    sit, which is the empirical case for baselining per patient instead of
    against one threshold
  * a false-positive rate — how often the deviation rule fires on people who
    are not deteriorating (see analysis/calibrate.py)

Column names are DISCOVERED, not assumed. This script has never been run
against the real file by its author, so it matches candidate substrings
against the actual header, prints what it mapped, and names what it could
not. Override anything wrong with --map metric=column.

Get the data (615 MB, CC-BY-4.0, no registration):
    curl -L -o rais.zip "https://zenodo.org/records/7229547/files/rais_anonymized.zip?download=1"
    unzip rais.zip

Usage:
    python3 pipeline/load_lifesnaps.py daily_fitbit_sema_df_unprocessed.csv out.csv
    python3 pipeline/load_lifesnaps.py in.csv out.csv --map spo2=oxygen_sat --inspect
"""
import argparse
import csv
import sys

# Ordered by preference. First substring that hits a header wins.
CANDIDATES = {
    "subject":           ["id", "user_id", "participant", "subject"],
    "date":              ["date", "day", "timestamp"],
    "resting_heart_rate":["resting_hr", "restingheartrate", "resting_heart"],
    "hr_night":          ["nremhr", "nightly_hr", "sleep_hr", "bpm"],
    "hrv_sdnn":          ["rmssd", "hrv", "sdnn"],
    "respiratory_rate":  ["breathing_rate", "respiratory_rate", "breathingrate", "respiration"],
    "spo2":              ["spo2", "oxygen_saturation", "oxygen_sat"],
    "sleep_hours":       ["sleep_duration", "minutesasleep", "minutes_asleep", "sleep_minutes"],
    "steps":             ["steps", "step_count"],
}
REQUIRED = {"subject", "date"}
# Enough signal to be worth a row at all.
MIN_METRICS = 2

OUT_FIELDS = ["patient_id", "date", "resting_heart_rate", "hr_night", "hrv_sdnn",
              "respiratory_rate", "spo2", "sleep_hours", "steps", "hrv_measure"]

# LifeSnaps ships RMSSD; our own export is genuinely SDNN. They are different
# HRV measures and their absolute values are not comparable. We write RMSSD
# into the hrv_sdnn column for schema compatibility and record the truth in
# hrv_measure. This is safe here because the cohort is only ever used for
# within-subject z-scores, where the choice of HRV measure cancels out --- but
# never quote a LifeSnaps HRV number as SDNN.
HRV_MEASURE_BY_COLUMN = {"rmssd": "rmssd", "sdnn": "sdnn", "hrv": "unknown"}


def discover(header, overrides):
    """Map our metric names onto whatever this file calls them."""
    lowered = {h.lower().strip(): h for h in header}
    mapping, unmapped = {}, []
    for metric, patterns in CANDIDATES.items():
        if metric in overrides:
            mapping[metric] = overrides[metric]
            continue
        hit = None
        for pattern in patterns:
            # Exact match first so "bpm" does not beat "resting_hr" for rhr.
            if pattern in lowered:
                hit = lowered[pattern]
                break
        if hit is None:
            for pattern in patterns:
                for low, original in lowered.items():
                    if pattern in low:
                        hit = original
                        break
                if hit:
                    break
        if hit:
            mapping[metric] = hit
        else:
            unmapped.append(metric)
    return mapping, unmapped


def normalise(metric, value):
    """Put LifeSnaps units into ours. Returns None to drop the value."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number <= 0:
        return None
    if metric == "sleep_hours":
        # Fitbit reports sleep in minutes, sometimes in milliseconds.
        if number > 100000:
            number /= 3_600_000
        elif number > 24:
            number /= 60
    if metric == "spo2" and number <= 1:
        number *= 100
    return round(number, 2)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("infile", help="daily_fitbit_sema_df_unprocessed.csv")
    parser.add_argument("outfile", nargs="?", default="fixtures/lifesnaps_daily.csv")
    parser.add_argument("--map", action="append", default=[], metavar="metric=column",
                        help="override a discovered column, repeatable")
    parser.add_argument("--inspect", action="store_true", help="print the header and exit")
    args = parser.parse_args()

    overrides = dict(pair.split("=", 1) for pair in args.map)

    with open(args.infile, encoding="utf-8", errors="replace", newline="") as handle:
        reader = csv.DictReader(handle)
        header = reader.fieldnames or []
        if args.inspect:
            print(f"{len(header)} columns in {args.infile}:")
            for name in header:
                print(f"  {name}")
            return

        mapping, unmapped = discover(header, overrides)
        print("column mapping")
        for metric in CANDIDATES:
            found = mapping.get(metric)
            print(f"  {metric:<20}{found if found else '— not found'}")
        missing_required = REQUIRED - set(mapping)
        if missing_required:
            raise SystemExit(
                f"\ncannot proceed: no column matched {', '.join(sorted(missing_required))}.\n"
                f"Run with --inspect to see the header, then pass --map {list(missing_required)[0]}=<column>."
            )
        if unmapped:
            print(f"\n  unmapped: {', '.join(unmapped)} — override with --map if the file has them")

        metrics = [m for m in OUT_FIELDS if m not in ("patient_id", "date") and m in mapping]
        rows, skipped = [], 0
        for record in reader:
            out = {
                "patient_id": (record.get(mapping["subject"]) or "").strip(),
                "date": (record.get(mapping["date"]) or "").strip()[:10],
            }
            if not out["patient_id"] or not out["date"]:
                skipped += 1
                continue
            present = 0
            for metric in metrics:
                value = normalise(metric, record.get(mapping[metric]))
                out[metric] = "" if value is None else value
                present += value is not None
            source = (mapping.get("hrv_sdnn") or "").lower()
            out["hrv_measure"] = next(
                (v for k, v in HRV_MEASURE_BY_COLUMN.items() if k in source), "unknown"
            ) if out.get("hrv_sdnn") != "" else ""
            for metric in OUT_FIELDS:
                out.setdefault(metric, "")
            if present < MIN_METRICS:
                skipped += 1
                continue
            rows.append(out)

    if not rows:
        raise SystemExit("no usable rows — check the mapping above against --inspect output")

    with open(args.outfile, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUT_FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    measures = {r["hrv_measure"] for r in rows if r.get("hrv_measure")}
    if measures and measures != {"sdnn"}:
        print(f"\n  NOTE: HRV in this file is {'/'.join(sorted(measures))}, not SDNN. It is written to")
        print( "  the hrv_sdnn column for schema compatibility. Within-subject z-scores are")
        print( "  unaffected, but never quote these values as SDNN.")

    subjects = {r["patient_id"] for r in rows}
    dates = sorted(r["date"] for r in rows)
    print(f"\n{args.outfile}: {len(rows)} subject-days, {len(subjects)} subjects, "
          f"{dates[0]} .. {dates[-1]} ({skipped} rows skipped)")
    print(f"\n  {'metric':<20}{'rows':>8}{'coverage':>10}")
    for metric in metrics:
        n = sum(1 for r in rows if r[metric] != "")
        print(f"  {metric:<20}{n:>8}{100*n/len(rows):>9.0f}%")


if __name__ == "__main__":
    main()
