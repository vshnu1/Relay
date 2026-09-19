#!/usr/bin/env bash
# End-to-end run: raw export -> committed de-identified aggregates -> evidence.
#
#   ./run_pipeline.sh data/raw/apple_health_export/export.xml
#
# Only the de-identified CSV and the evidence JSON are safe to commit; the
# intermediates are gitignored.
set -euo pipefail

# data/ is gitignored, so it will not exist on a fresh clone.
mkdir -p data/raw

XML="${1:-data/raw/apple_health_export/export.xml}"
if [[ ! -f "$XML" ]]; then
  echo "no export at $XML" >&2
  echo "unzip your Apple Health export into data/raw/ first, or pass a path" >&2
  exit 1
fi

echo "[1/5] parsing export"
python3 pipeline/parse_export.py "$XML" data/events.csv

echo "[2/5] aggregating to patient-days"
python3 pipeline/aggregate.py data/events.csv data/daily.csv

echo "[3/5] de-identifying"
python3 pipeline/deidentify.py data/daily.csv fixtures/daily_deid.csv

echo "[4/5] exporting the shared-engine event contract"
python3 pipeline/to_relay_events.py fixtures/daily_deid.csv fixtures/relay_events.json

echo "[5/5] detecting coordinated deviations"
python3 analysis/detect.py fixtures/daily_deid.csv fixtures/evidence.json
