#!/usr/bin/env bash
# End-to-end run: raw Apple Health export -> committed de-identified outputs.
#
#   ./run_pipeline.sh [path/to/export.xml]
#
# Two aggregation tracks, because two consumers need different granularity:
#
#   daily   (24h)  analysis/detect.py — "a persistent deviation" is a
#                  statement about days
#   windows  (6h)  shared/engine.js — its baseline gate needs 12 samples in
#                  14 days, which daily rows cannot supply. See docs/INTEROP.md
#
# Only fixtures/ is committed. data/ is gitignored working state.
set -euo pipefail

# data/ is gitignored, so it will not exist on a fresh clone.
mkdir -p data/raw

XML="${1:-data/raw/apple_health_export/export.xml}"
if [[ ! -f "$XML" ]]; then
  echo "no export at $XML" >&2
  echo "unzip your Apple Health export into data/raw/ first, or pass a path" >&2
  exit 1
fi

echo "[1/6] parsing export"
python3 pipeline/parse_export.py "$XML" data/events.csv

echo "[2/6] aggregating to patient-days"
python3 pipeline/aggregate.py data/events.csv data/daily.csv --window 24

echo "[3/6] aggregating to 6-hour windows"
python3 pipeline/aggregate.py data/events.csv data/windows.csv --window 6

echo "[4/6] de-identifying both tracks"
python3 pipeline/deidentify.py data/daily.csv fixtures/daily_deid.csv
python3 pipeline/deidentify.py data/windows.csv fixtures/windows_deid.csv

echo "[5/6] exporting the shared-engine event contract"
python3 pipeline/to_relay_events.py fixtures/windows_deid.csv fixtures/relay_events.json

echo "[6/6] detecting coordinated deviations"
python3 analysis/detect.py fixtures/daily_deid.csv fixtures/evidence.json
