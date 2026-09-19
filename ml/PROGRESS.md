# ML workstream progress

Branch: `Pranav`. Owner: Pranav (ML and synthetic). Scope: `ml/**`, `docs/ML.md`.

## Milestones

- [x] define ml ownership — one row added to `AGENTS.md`
- [x] scaffold ml pipeline — package, contracts mirroring `shared/engine.js`, program configs, CLI skeleton, engine-parity synthetic generator, unittest suite
- [x] parse health export — streaming Apple Health reader behind `HEALTH_EXPORT_XML`, generic source categories, six-hour aggregation, aggregate-only logging
- [x] build baseline features — six-hour windows, cadence-aware staleness, median/MAD baselines, robust deviations, missingness and coverage features
- [x] train anomaly model — SimpleImputer(add_indicator) + RobustScaler + IsolationForest, chronological split, validation-calibrated threshold, persistence, synthetic-only prior artifact
- [x] add synthetic scenarios — postoperative drift, missing sensor, gait decline; fixtures under `ml/fixtures/synthetic/`
- [ ] test ml pipeline — end-to-end CLI tests and scenario outcome tests
- [ ] private local validation — read-only run on the export, aggregate report in `ml/reports/`
- [ ] document ml handoff — `docs/ML.md`

## Decisions and assumptions

- Package lives at `ml/vesper_ml`, invoked as `python -m vesper_ml` with `ml/` on `PYTHONPATH`.
- Tests use `unittest` (`python3 -m unittest discover -s ml/tests -t ml`).
- Output is a superset of the existing evidence object; legacy `state` keeps `quiet`/`context`/`review`.
- Engine parity verified once via Node: `simulate("ambiguous"|"explained", 1789732800000)` in `shared/engine.js` and `vesper_ml.synthetic.simulate` produce identical 378-event lists (metric, value, timestamp, source).
- Every contract event value is a level (a reading), not an increment. Windows take the mean of in-window samples; empty windows fall back to a trailing lookback of max(6h, 1.5 x metric cadence) and are stale beyond it.
- Robust scale = max(1.4826 x MAD, legacy percent threshold / 3 of the median). Demo configuration so near-constant synthetic histories do not amplify ordinary fluctuation.

## Model notes (train anomaly model)

- Pipeline: `SimpleImputer(median, add_indicator=True)` -> `RobustScaler` -> `IsolationForest(200 trees, seed)`, fitted per patient on that patient's own history windows, chronological 60/20/20 split. Threshold = 95th percentile of validation raw scores, floored by the train quantile. Score in [0, 1] is a logistic centred on the threshold; 0.5 = at threshold.
- `is_anomalous` needs the last `min_persistence_windows` (3) recent windows above threshold and data quality not insufficient. The model alone can only yield monitoring / context_needed / insufficient_data.
- Features per window: winsorized robust deviations (+/-5) for every program metric, core coverage fraction, count of fresh metrics, count of core metrics beyond the deviation threshold, mean absolute core deviation. Missingness indicators come from the imputer.
- Recent window = max(36h, 3 x cadence) rounded up to whole six-hour blocks, where cadence is the median of the program's core metrics' own cadences. Daily gait or resting-heart-rate data gets a 72h window; six-hourly synthetic data keeps the engine's 36h.
- Single-signal `flagged` requires >= 3 consecutive deviated windows, >= 2 supporting observations, and duration (analysis end - first deviated observation) >= program minimum hours. The deterministic coordinated rule needs `min_coordinated` flagged signals with overlapping runs.
- Synthetic prior: `ml/artifacts/synthetic-prior-post_abdominal_surgery.{joblib,json}`, trained on 40 synthetic patients (2,085 / 694 / 696 rows), 13 input features, 21 after indicators, validation exceed rate 0.028, test 0.051, about 1 s to train. Used only when a patient has fewer than 16 usable history windows; the result is labelled `model.status = "prior"` and `training_data = "synthetic"`.
- Stability: the seed-0 fixtures give the same application state for model seeds 0-7 in every scenario. Scoring one request takes about 0.1 s.

## Scenario outcomes (add synthetic scenarios)

Fixtures: `python -m vesper_ml fixtures` writes one request per scenario plus `expected.json` under `ml/fixtures/synthetic/` (anchor 2026-09-18T12:00Z, generator seed 0). All synthetic.

| Scenario | Program | Without context | With context |
| --- | --- | --- | --- |
| ambiguous | post_abdominal_surgery | context_needed (rule + model, 5 signals flagged) | n/a |
| explained | post_abdominal_surgery | monitoring | monitoring |
| review | post_abdominal_surgery | context_needed | review_recommended |
| postoperative_drift | post_abdominal_surgery | context_needed (model; rhr flagged) | review_recommended |
| missing_sensor | post_abdominal_surgery | insufficient_data (legacy `context`, data_quality insufficient) | n/a |
| gait_decline | stroke_rehabilitation | context_needed (model) | review_recommended |

- Realistic-cadence scenarios sample like the real export: resting HR about 60% of days, HRV about 3/day on 70% of days, SpO2 four a day, sleep nightly, phone gait near-daily.
- Robustness across generator seeds (model seed 0): gait_decline 6/8 context_needed; postoperative_drift about half. Misses coincide with days where the synthetic resting-HR or HRV reading is absent, so the model does not invent a deviation from stale data. Seed 0 is the committed fixture and is stable across model seeds.
