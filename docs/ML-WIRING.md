# Wiring the ML engine: what was done, and what it costs

The Python engine in `ml/relay_ml` passes 60 tests, covers 14 programs, and has
a measured false-positive rate. **It is wired, deployed and running.** This
document used to argue for leaving it unwired; that argument was overtaken, and
the record of what actually happened is more useful than the argument.

## What it is attached to

| Piece                 | Where                                                                              |
| --------------------- | ---------------------------------------------------------------------------------- |
| The route             | `POST /api/ml/score` in `server/index.js`                                          |
| The spawn             | `scoreWithRelay()` in `server/relayModel.js`, `python -m relay_ml score --compact` |
| The browser client    | `src/recovery/model/mlClient.js`                                                   |
| The clinician surface | `src/recovery/doctor/ModelCard.jsx`, which runs it on mount                        |
| The patient surface   | `src/recovery/patient/Insight.jsx` via `useAnalysis.js`                            |
| Off by default        | `RELAY_ML_ENABLED`, with `PYTHON_BIN` naming the interpreter                       |

The subprocess contract from `docs/ML.md` step 2 works exactly as written.
Spawned from Node with `PYTHONPATH=ml`, request JSON on stdin:

```
exit 0 in 1561ms
application_state: context_needed    legacy state: context
anomaly_score: 0.89                  model: fitted
signals array present: true (6)      restraint: true    cohort: true
```

The output is a superset of the legacy evidence object, so the server's
completeness check and the FHIR builder did not need changing.

## What each of the three objections turned out to be

**"Nothing installs Python packages."** True of the blueprint as written, and it
was the real blocker. `render.yaml` now builds with
`npm ci --include=dev && npm run build && pip install -r requirements.txt`,
followed by a line that imports sklearn and numpy so the build fails loudly
rather than the first request failing quietly.

Two things bit on the way. `npm ci` alone installed 101 packages and no Vite,
because Render sets `NODE_ENV=production` and npm then skips devDependencies —
hence `--include=dev`. And scikit-learn 1.5 has no wheel for Python 3.14, so
`PYTHON_VERSION` is pinned to 3.12.11. Neither had anything to do with the
runtime being Node; that part of the old objection was simply wrong.

**"The deploy has never succeeded once."** It has now, and the ordering held: the
deploy was made to work first, and Python was added to a build that was already
green, so a failure could only have one cause.

**"1561ms per score is wrong for a list."** Still true, and still unsolved. The
watchlist shows 28 patients; scoring per row would be about 44 seconds. Nothing
scores per row — the model runs when a clinician opens one patient's model view,
and when a patient asks for a score. A watchlist-wide score needs a batch
endpoint or a cache, and that is design work rather than plumbing.

## What is safe to say

> We built the anomaly model our own spec called for, measured it against 71
> real subjects, and it runs on the deployed demo behind a flag. The
> deterministic rule still decides what is surfaced, because an isolation score
> cannot be traced to the measurement that caused it. The model corroborates or
> disagrees, and the clinician sees which.

Do not say the model decides anything. `fixtures/ml_calibration.json` and
`docs/DATA.md` carry the numbers.
