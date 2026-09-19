# Wiring the ML engine: verified recipe, and why it is not applied

The Python engine in `ml/relay_ml` passes 53 tests, covers six programs, and
has a measured false-positive rate. **It has no caller.** `grep` finds zero
references to it in `server/index.js`, `workflows/tasks.js` or anywhere under
`src/`.

This document records what was verified, what the remaining risk is, and the
exact change to make — deliberately not made.

## What was verified

The subprocess contract from `docs/ML.md` step 2 works exactly as written.
Spawned from Node with `PYTHONPATH=ml`, request JSON on stdin:

```
exit 0 in 1561ms
application_state: context_needed    legacy state: context
anomaly_score: 0.89                  model: fitted
signals array present: true (6)      restraint: true    cohort: true
```

The output is a superset of the legacy evidence object, so the server's
completeness check and the FHIR builder would not break. Pranav's design here
is sound.

## Why it is not wired

**One:** `render.yaml` declares `runtime: node` with
`buildCommand: npm ci && npm run build`. Nothing installs Python packages.
Seven modules under `ml/relay_ml/` import numpy at module level
(`baseline`, `explain`, `features`, `model`, `score`, `train`, `windows`), so
the first import crashes rather than degrading. There is no partial success.

**Two:** making it work means editing `render.yaml` and `server/index.js` —
both deploy-critical, both currently green — on a Render deploy that **has
never succeeded once.** If the deploy then fails, the cause is ambiguous
between the Python addition and whatever was already wrong. Render Workflows
is a prize track; spending it to reach an engine the demo does not show is a
bad trade.

**Three:** 1561ms per score is fine for one patient and wrong for a list. The
watchlist shows eight. Called per row that is twelve seconds, so wiring it
properly means a cache or a batch endpoint, not a spawn per request. That is
design work, not plumbing.

## The recipe, if the deploy is already working and there is time

`requirements.txt` is committed, so this is two edits.

1. In `render.yaml`, extend the build:

   ```yaml
   buildCommand: pip install -r requirements.txt && npm ci && npm run build
   ```

   Confirm the node runtime image has `python3` and `pip` before relying on
   this. If it does not, the answer is a Docker runtime, which is not a
   T-minus-hours change.

2. In `workflows/tasks.js`, add a task that spawns the engine and attach its
   result **beside** `compileReviewItem`, never replacing it. If the spawn
   fails, the deterministic result must still be returned.

Do this only in that order, only after `/api/status` reports
`render: true`, and revert at the first sign of trouble.

## What to say instead

The work is real and the honest claim costs nothing:

> We built the anomaly model our own spec called for, measured it against 71
> real subjects, and shipped the deterministic engine because an isolation
> score cannot be traced to the measurement that caused it.

Say "we built and measured it." Do not say it is running in the demo.
`fixtures/ml_calibration.json` and `docs/DATA.md` carry the numbers.
