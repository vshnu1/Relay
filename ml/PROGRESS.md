# ML workstream progress

Branch: `Pranav`. Owner: Pranav (ML and synthetic). Scope: `ml/**`, `docs/ML.md`.

## Milestones

- [x] define ml ownership — one row added to `AGENTS.md`
- [x] scaffold ml pipeline — package, contracts mirroring `shared/engine.js`, program configs, CLI skeleton, engine-parity synthetic generator, unittest suite
- [x] parse health export — streaming Apple Health reader behind `HEALTH_EXPORT_XML`, generic source categories, six-hour aggregation, aggregate-only logging
- [ ] build baseline features — six-hour windows, cadence-aware staleness, median/MAD baselines, robust deviations, missingness and coverage features
- [ ] train anomaly model — SimpleImputer(add_indicator) + RobustScaler + IsolationForest, chronological split, validation-calibrated threshold, persistence, synthetic-only prior artifact
- [ ] add synthetic scenarios — postoperative drift, missing sensor, gait decline; fixtures under `ml/fixtures/synthetic/`
- [ ] test ml pipeline — end-to-end CLI tests and scenario outcome tests
- [ ] private local validation — read-only run on the export, aggregate report in `ml/reports/`
- [ ] document ml handoff — `docs/ML.md`

## Decisions and assumptions

- Package lives at `ml/vesper_ml`, invoked as `python -m vesper_ml` with `ml/` on `PYTHONPATH`.
- Tests use `unittest` (`python3 -m unittest discover -s ml/tests -t ml`).
- Output is a superset of the existing evidence object; legacy `state` keeps `quiet`/`context`/`review`.
- Engine parity verified once via Node: `simulate("ambiguous"|"explained", 1789732800000)` in `shared/engine.js` and `vesper_ml.synthetic.simulate` produce identical 378-event lists (metric, value, timestamp, source).
