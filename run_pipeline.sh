#!/usr/bin/env bash
# End-to-end run: raw export -> committed de-identified aggregates -> evidence.
#
#   ./run_pipeline.sh data/raw/apple_health_export/export.xml
#
# Only the de-identified CSV and the evidence JSON are safe to commit; the
# intermediates are gitignored.
set -euo pipefail

XML="${1:-data/raw/apple_health_export/export.xml}"
if [[ ! -f "$XML" ]]; then
  echo "no export at $XML" >&2
  echo "unzip your Apple Health export into data/raw/ first" >&2
  exit 1
fi

echo "[1/4] parsing export"
python3 pipeline/parse_export.py "$XML" data/events.csv

echo "[2/4] aggregating to patient-days"
python3 pipeline/aggregate.py data/events.csv data/daily.csv

echo "[3/4] de-identifying"
python3 pipeline/deidentify.py data/daily.csv data/daily_deid.csv

echo "[4/4] detecting coordinated deviations"
python3 analysis/detect.py data/daily_deid.csv data/evidence.json
