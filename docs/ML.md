# ML handoff — `ml/relay_ml`

Owner: Pranav (ML and synthetic). Branch: `Pranav`. Scope: `ml/**`, `docs/ML.md`.
Progress log and decisions: [`ml/PROGRESS.md`](../ml/PROGRESS.md).

One personalized anomaly engine behind a stdin/stdout CLI. It accepts the
event contract the app already uses, returns a superset of the evidence object
the UI already renders, and adds the fields the Relay brief asks for. It does
not diagnose, predict risk, or decide that a patient is safe.

## Run it

Requirements: Python 3.10+, numpy, scikit-learn (joblib comes with it). No
other dependencies. Tests use `unittest`.

```bash
PYTHONPATH=ml python3 -m unittest discover -s ml/tests -t ml
```

```bash
PYTHONPATH=ml python3 -m relay_ml synthetic --scenario postoperative_drift | PYTHONPATH=ml python3 -m relay_ml score
```

```bash
PYTHONPATH=ml python3 -m relay_ml synthetic --scenario review --context | PYTHONPATH=ml python3 -m relay_ml score --compact
```

```bash
PYTHONPATH=ml python3 -m relay_ml fixtures
```

```bash
PYTHONPATH=ml python3 -m relay_ml train-synthetic
```

```bash
HEALTH_EXPORT_XML=/path/to/export.xml PYTHONPATH=ml python3 -m relay_ml validate-export
```

Subcommands: `score` (stdin JSON -> stdout JSON, touches no files),
`synthetic` (emit a scenario request; `--context` includes its structured
check-in), `fixtures` (regenerate `ml/fixtures/synthetic/`), `train-synthetic`
(rebuild the synthetic-only prior under `ml/artifacts/`), `validate-export`
(read-only aggregate report from a private Apple Health export).

## Input contract

```json
{
  "events": [
    { "metric": "rhr", "value": 64, "unit": "bpm", "timestamp": "2026-09-18T12:00:00Z", "source": "Simulated wearable" }
  ],
  "context": { "exercise": "No unusual activity", "fatigue": "Worsening", "medication": "No changes", "consent": true },
  "program": "post_abdominal_surgery",
  "analyzedThrough": "2026-09-18T12:00:00Z",
  "patient_id": "demo-01",
  "seed": 0
}
```

- `events` follow `shared/engine.js` exactly: known metric, unit must match,
  timestamp with timezone, finite value in range, non-empty source, no
  duplicate metric/timestamp. Records get the same ids (`obs-<metric>-<ms>`)
  and the same ISO format as the engine, so `sourceIds` and `recent` line up
  with what the server stores.
- Legacy metrics: `rhr`, `hrv`, `respiratory`, `sleep`, `glucose`, `spo2`.
  Internal metrics accepted in the same shape (the JS engine does not know
  them, so do not send them to it): `heart_rate`, `steps`, `walking_speed`,
  `step_length`, `walking_asymmetry`, `double_support`, `walking_steadiness`,
  `temperature`, `weight`, `systolic_bp`, `diastolic_bp`. Every value is a
  level per reading, never an increment.
- `context` is optional. Enumerated strings and booleans survive; free text
  and nested objects are dropped. The three engine fields plus any
  program-specific fields (see programs) are read.
- `program` defaults to `post_abdominal_surgery`. `analyzedThrough` is
  optional; events after it are ignored. `seed` defaults to 0.

## Output contract

Legacy fields, unchanged in meaning, so the current UI and FHIR builder keep
working: `state` (`quiet` | `context` | `review`), `summary`, `coordinated`,
`overlapHours`, `windowHours`, `cadenceHours`, `analyzedThrough`, `rule`,
`context`, `signals[]` with `metric`, `label`, `unit`, `source`, `color`,
`base`, `threshold`, `baseline{mean, sd, median, mad, count, sufficient,
start, end, method}`, `current`, `delta` (percent from the patient's median),
`duration`, `flagged`, `fresh`, `quality` (`Available` | `Missing recent data`
| `Insufficient baseline`), `recent[]` (normalized events in the recent
window), `sourceIds[]` (events inside the persistent run), `start`, `end`.
Signals also carry `robust_deviation`, `direction`, `persistence_windows`.

Added fields:

| Field | Meaning |
| --- | --- |
| `application_state` | `monitoring`, `context_needed`, `review_recommended`, `insufficient_data` |
| `anomaly_score` | 0-1, logistic around the validation-calibrated threshold (0.5 = at threshold); `null` if the model was unavailable |
| `is_anomalous` | model flag held for the last 3 six-hour windows and data quality not insufficient |
| `rule_coordinated` | the deterministic rule alone (`coordinated` = rule OR model) |
| `change_point` | start of the terminal anomalous run, or earliest flagged run |
| `contributors[]` | largest robust deviations at the latest window: `metric`, `direction`, `robust_deviation`, `percent_delta`, `persistence_windows`, `flagged`, `supporting_ids`, `latest_observed_at` |
| `missing_signals[]` | program metrics with `no_data`, `stale`, or `insufficient_baseline`, with `core` flag |
| `data_quality` | `status` (`sufficient` / `partial` / `insufficient`), `coverage`, core readiness, cadence, window counts |
| `protocol_notes[]` | illustrative program rules that fired on check-in answers |
| `model` | `status` (`fitted` / `prior` / `unavailable`), window scores, feature columns, split sizes, threshold, exceed rates, timing |
| `model_version`, `program`, `patient_id`, `window_start`, `window_end` | provenance |

State mapping: `monitoring -> quiet`, `context_needed -> context`,
`review_recommended -> review`, `insufficient_data -> context` with
`data_quality.status = "insufficient"`. The unsupervised model alone never
yields `review_recommended`; that needs structured check-in context on top of
an anomaly or coordinated rule, or an illustrative protocol rule.

## How it works

1. **Normalize** events (engine rules) and structured context.
2. **Windows**: six-hour grid ending at `analyzedThrough`. Each window holds
   the mean of its own samples; an empty window borrows the mean of a trailing
   lookback of max(24h, 2 x that metric's cadence) and records how old the
   newest reading is. Beyond the lookback the window is *stale*, never normal.
3. **Baselines**: per window and metric, median and MAD (scaled 1.4826) of the
   observed windows in the preceding 28 days, ending one recent-window length
   before the window under test. Sufficient only with >= 8 observed windows
   spanning >= 72 h. The MAD is floored at one third of the metric's legacy
   percent threshold. A new device has no baseline until it has history, so
   its arrival is not an anomaly.
4. **Features**: robust deviation per program metric (nan when stale or
   without baseline, winsorized at +/-5), core coverage fraction, fresh-metric
   count, count of core metrics beyond the deviation threshold, mean absolute
   core deviation. `SimpleImputer(add_indicator=True)` adds missingness
   indicators.
5. **Model**: `RobustScaler` -> `IsolationForest` (200 trees) fitted on this
   patient's history windows with a chronological 60/20/20 split. Threshold at
   the 95th percentile of validation scores (floored by the train quantile).
   Recent windows are scored; `is_anomalous` needs the last three windows above
   threshold. Fewer than 16 usable history windows falls back to a
   synthetic-only prior labelled as such.
6. **Deterministic rule** (engine-compatible): a signal is flagged when its
   deviation has held >= 3 consecutive windows with >= 2 supporting
   observations for >= 24 h (48 h for gait). Three flagged signals with
   overlapping runs are `rule_coordinated`.
7. **Explain**: contributors come from the actual robust deviations, their
   direction, persistence, and the ids of supporting observations. Isolation
   Forest gives no feature importance and none is claimed.
8. **Context and rules** are applied outside the model to decide the state and
   append patient-reported facts to the summary.

The recent window is max(36 h, 3 x cadence) rounded up to whole six-hour
blocks, where cadence is the median of the program's core metrics' own median
sampling gaps. Six-hourly synthetic data keeps the engine's 36 h; daily
wearable data gets 72 h. This is what lets once-a-day resting heart rate and
HRV pass a baseline gate; the engine's 12-samples-in-14-days rule cannot on
real wearables (see Anson's `docs/INTEROP.md`).

## Programs

Configuration only, in `ml/relay_ml/programs.py`. Fourteen monitoring
programs share the engine: `post_abdominal_surgery` (the one measured most),
`copd_recovery`, `pneumonia_recovery`, `heart_failure_recovery`,
`sepsis_watch`, `respiratory_infection`, `asthma_recovery`,
`pulmonary_embolism_recovery`, `sleep_apnoea_titration`,
`postpartum_recovery`, `joint_replacement_recovery`, `post_chemotherapy`,
`stroke_rehabilitation` (functional recovery only; it does not detect or rule
out a new stroke) and `cardiac_recovery`. Every one has a synthetic-only prior
under `ml/artifacts/`, trained by `ml/relay_ml/train.py` on a population
drawn from that program's own core metrics, so a patient with days of history
is scored rather than refused. Each lists its metrics, core metrics
for coverage, relevant check-in fields, and one or two illustrative protocol
rules (for example `shortness_of_breath: true` in the surgical program lifts
the state to `review_recommended` regardless of the score). They are
placeholders for clinician-defined protocols and are labelled as illustrative
in the summary.

## Synthetic scenarios and fixtures

`ml/fixtures/synthetic/<scenario>.json` holds a request and its expected
outcome; `expected.json` indexes them. `ambiguous`, `explained`, `review`
reproduce `shared/engine.js` `simulate()` value for value (verified against
Node). `postoperative_drift`, `missing_sensor`, `gait_decline` use realistic
cadence and missingness. Outcomes are in `ml/PROGRESS.md`. All fixtures are
synthetic and safe to commit.

## Privacy

The private Apple Health export is read only through `HEALTH_EXPORT_XML` or
an explicit CLI path. The reader streams the XML, keeps one source per metric
(the one with the most records, chosen in memory), collapses sources to
`wearable` / `phone` / `manual` / `unknown`, and emits six-hour aggregates. It
never logs device names, metadata, raw observations, or dates finer than a
month. `ml/reports/private_export_validation.json` holds counts, coverage,
dimensions, timings, state distributions, and de-identified model
diagnostics only. Nothing person-level is written inside the repository; the
committed model artifact is trained on synthetic data and says so in its
metadata.

## Private export validation

Read-only run through `HEALTH_EXPORT_XML`; the report at
`ml/reports/private_export_validation.json` is aggregate only.

- 852,070 records streamed in 4.9 s into 22,033 six-hour aggregate events
  over 13 metrics; one source kept per metric, collapsed to wearable / phone
  / manual.
- Surgical program, latest point: `monitoring`, score 0.10, all five core
  metrics ready. The forest trained on the 333 windows of the vital-sign era
  (200 / 67 / 66); 5,099 phone-only windows were excluded because no core
  signal existed yet.
- 61 daily back-test points: 48 `monitoring`, 13 `insufficient_data`, 0
  `context_needed`. Steps flagged alone on 3 points and never coordinated.
- Gait program over four years of phone gait: `monitoring` at every point,
  data quality sufficient throughout.
- Timings: 70 s for the whole validation; 0.3-0.8 s per scored request.

This is software validation on one healthy person's data. It shows the engine
stays quiet on ordinary days and reports `insufficient_data` when it cannot
see, and it exposed and fixed a device-era flaw in the training split. It is
not clinical validation and says nothing about sensitivity to real
complications.

## Integration for the workflow owner

The package is designed to slot behind one new task in `workflows/tasks.js`
without touching `shared/engine.js`:

1. Add a Python runtime to the workflow service (Render lets a Node service
   install Python; `numpy` and `scikit-learn` are the only packages).
2. In a new task, spawn `python3 -m relay_ml score --compact` with
   `PYTHONPATH=ml` and write the request JSON to stdin; parse stdout.
3. The result already contains `signals` (the server's completeness check),
   `state`, `summary`, `coordinated`, `context`, `rule`, so it can replace the
   `compileReviewItem` output directly or be attached beside it.
4. Pass the check-in answers as `context`; the second workflow run then moves
   `context_needed` to `review_recommended` without rescoring differently.
5. Choose `program` per patient (default `post_abdominal_surgery`).

Expected failure modes: a non-zero exit with a `ContractError` message on
stderr for malformed events; `model.status = "unavailable"` with the
deterministic rule still applied when history is too short and no prior
matches the program.

## Known limits

- Demo thresholds, not clinical rules. Nothing here is clinically validated.
- Isolation Forest on a handful of features is modest; the deterministic rule
  and the explanations carry the auditability. Measured against the rule on
  the same injected change (`analysis/sensitivity_ml.py`), the model is the
  quiet one, not the sensitive one: it speaks for about a fifth as many
  untouched subjects and never catches more injected changes than the rule — though on real gait
  data (`analysis/sensitivity_gait.py`) it comes close, 77–90% against 100%
  at two personal standard deviations, while speaking on a tenth as many
  untouched episodes. It
  does not catch what the rule misses on this data. Its place is as a second
  opinion beside the rule, which is how the clinician view uses it.
- Per-patient fit needs roughly two weeks of history at daily cadence; before
  that the program's synthetic prior stands in and is labelled as such in
  `model.status` and `model.training_data`.
- A metric absent from the whole history is silently dropped by the imputer,
  which is the intended new-device behaviour, but it also means a brand-new
  sensor contributes nothing until it has a baseline.
