# fixtures

De-identified derived data, safe to commit. Kept out of `data/`, which is
gitignored repo-wide because raw health exports must never be committed.

| File | What it is |
|---|---|
| `daily_deid.csv` | 1,464 patient-days of daily aggregates, pseudonymous id, dates shifted |
| `relay_events.json` | the same data in the `shared/engine.js` event contract |
| `evidence.json` | statistical evidence objects from `analysis/detect.py` |

Regenerate with `./run_pipeline.sh`. See [../docs/DATA.md](../docs/DATA.md)
for coverage and the de-identification method.
