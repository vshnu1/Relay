# Relay , Bay Hacks 2026

Provider-facing remote monitoring prototype. Synthetic measurements → individual baselines → persistent coordinated deviations → consented patient check-in → source-linked evidence summary and mock FHIR handoff.

## Run locally

Requires Node 22+ and Python 3.10+ for wearable conversion.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:5173. The API runs on port 3001. To serve the production bundle locally: `npm run build && npm start`, then open http://127.0.0.1:3001.

```sh
npm test
npm run build
python3 -m unittest discover -s tests -p '*_test.py'
```

Working project name: Relay. React/Vite frontend, Express API, shared deterministic statistical engine. The default demo needs no external credentials. Data and application audit events persist under ignored `data/`; run a single API process only. For an isolated demo, set `DATA_DIR` to a new directory before starting the server.

## What works

- Three synthetic patients and three replayable scenarios: brief workout fluctuation, persistent coordinated deviation, completed check-in.
- Patient cohort, synchronized metric timelines, baseline comparisons, evidence brief, source record references on chart points.
- Analysis uses actual simulated/imported measurements. Three signals must each deviate beyond configured thresholds for ≥24h with ≥24h shared overlap. At least three consecutive samples are required. Baseline needs ≥12 points spanning ≥72h, excluding the recent window.
- Cadence-aware gaps and recent windows support 6-hour synthetic records and daily wearable exports. Missing data is explicit. The window is 36h or three sampling intervals, whichever is longer. Thresholds are demo configuration, not clinical rules.
- Consented structured text check-in updates the evidence summary. Optional ElevenLabs voice drafts answers; the patient confirms the structured form before saving.
- Acknowledgment, monitoring consent revocation/restoration, persistent application audit log, mock FHIR JSON export.
- Offline converters for the supplied Apple Watch CSV, WHOOP workbook, and Apple Health XML formats; normalized JSON import with validation.
- Real Render task definitions and SDK dispatch when configured, otherwise explicitly labeled local execution.

## Wearable files and privacy

The supplied archives contain real wearable measurements. Do not commit, upload, or send these records to ElevenLabs, Render, or the public demo. Converters run offline and omit profile/user identifiers, but their output remains sensitive health data; this is not a formal de-identification process. Keep outputs under ignored `data/private/`. The portal import requires synthetic/de-identified attestation; do not label real records synthetic. The public demo should use the included simulator.

```sh
python3 scripts/convert_wearables.py /path/to/hackathon.zip --format apple-csv --timezone-offset -4 --output data/private/apple.json
python3 scripts/convert_wearables.py /path/to/hackathon.zip --format whoop-xlsx --timezone-offset -4 --output data/private/whoop.json
python3 scripts/convert_wearables.py /path/to/export.zip --format apple-xml --timezone-offset -4 --source-filter 'Apple Watch' --output data/private/apple-health.json
```

Timezone offset must match the records; the fixed offset is unsuitable across DST boundaries without splitting the source. Date-only measurements use local midnight, an aggregation label rather than an exact observation time. WHOOP recovery uses `created_at` because the supplied Recovery sheet lacks a physiological measurement timestamp; treat it as export-record timing. Apple XML aggregates supported quantity records by source-local date. It deliberately omits sleep categories to avoid double-counting overlapping sleep stages. Filter to one device/source; validate export coverage before use. Keep Apple SDNN and WHOOP RMSSD HRV in separate datasets. Do not combine them into one baseline.

Normalized contract:

```json
{
  "events": [
    {
      "metric": "rhr",
      "value": 64,
      "unit": "bpm",
      "timestamp": "2026-09-18T12:00:00Z",
      "source": "Simulated wearable"
    }
  ]
}
```

Supported metrics/units: `rhr`/`bpm`, `hrv`/`ms`, `respiratory`/`/min`, `sleep`/`h`, `glucose`/`mg/dL`, `spo2`/`%`. Strict timestamps with timezone, numeric values, unique metric/timestamp pairs, max 10,000 records and 3 MB. Glucose currently measures mean deviation, not variability; BP, medication event feeds, and activity timeline overlays are follow-up work.

## Render Workflows

1. Create a Workflow service from the `Vishnu` branch in this repository in Render: build `npm ci`, start `node workflows/tasks.js`.
2. On the web/API service set `RENDER_API_KEY` and `RENDER_WORKFLOW_SLUG` (workflow name only, not the `/monitoringPipeline` suffix).
3. The API calls `<slug>/monitoringPipeline`. Its chained tasks normalize, calculate baseline, detect deviation, request context, and compile a review item. Check-in submission reruns this chain with the confirmed context.
4. Run a synthetic scenario and verify the returned Render execution ID in the API response and the actual task runs in the Render dashboard. This has not been live-tested without credentials. Local execution alone does not qualify for the Render prize.

References: https://render.com/docs/workflows-sdk-typescript and https://render.com/docs/workflows-defining.

For deployment, `render.yaml` provisions only the web service. Create the Workflow service separately. `APP_ACCESS_TOKEN` is required when `NODE_ENV=production`. The included disk persists demo state; it is not an encrypted, multi-tenant clinical database.

## ElevenLabs

Set `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` on the API server. Keep the key out of frontend code. The patient check-in uses an authenticated conversational agent after consent. The clinician overview can generate a one-way spoken status summary from synthetic readings and the latest Relay result; it reuses the agent's voice or an optional `ELEVENLABS_VOICE_ID`. Clinician summaries are blocked in production unless `ELEVENLABS_DEMO_SUMMARY_ENABLED=true`. Only enable that while the app contains synthetic demo data. Do not send real patient information to ElevenLabs without the required vendor agreements and privacy review. See `docs/voice-agent.md` for the patient agent instructions and client tool schema. No incoming webhooks are accepted; patient voice drafts must be confirmed in the form. A production webhook integration would require signature/replay verification.

Reference: https://elevenlabs.io/docs/eleven-agents/customization/authentication.

## Honest prototype boundaries

- This product presents statistical patterns; it does not diagnose, predict clinical risk, prescribe, or escalate emergencies.
- Summaries are deterministic templates; no LLM synthesis is currently used. Voice uses ElevenLabs only when configured.
- Shared-token provider access is optional locally and required in production. This is **not** patient/nurse/provider/admin RBAC. Audit identity is `demo-provider`.
- The append-only app log is not independently immutable or tamper-proof. No database encryption, per-source consent, retention/deletion automation, signed webhook endpoint, or clinical validation is claimed.
- Browser HTTPS and production identity, least privilege, encrypted storage, vendor BAAs, formal risk analysis, retention, and patient export/access controls remain deployment work. Do not claim HIPAA compliance.
- FHIR output is a mock collection with traceable measurements, not a validated EHR integration.
- Baselines use each dataset's latest record as analysis time. This is retrospective analysis; historical datasets are not live monitoring.
- Imported de-identified records are analyzed locally. External workflow/voice integrations reject them.

## Demo (2–3 minutes)

1. Introduce the fragmented remote-data problem; open Alex Morgan.
2. Show the aligned measurement timelines and each individual baseline.
3. Simulate a coordinated deviation and open “Why flagged.” Explain the 24-hour persistence and source references.
4. Open the check-in, grant consent, select no unusual activity / worsening fatigue / no medication changes, and submit.
5. Show the updated evidence brief, acknowledge review, download the mock FHIR bundle, and inspect the audit trail.
6. Switch to the workout scenario to show an isolated fluctuation creates no persistent review trigger.
7. Close: “The platform gives providers a source-linked statistical summary. It does not diagnose.”

Submission: Nucleate Florida Healthcare Challenge main track. Optional ElevenLabs/Render tracks only with working integrations. Devpost lists the deadline as September 19, 2026, 7 PM ET and requires a 2–3 minute video and code link. The implementation was started during the event; the earlier document in `docs/project-handoff.md` is planning material.

## Validation

Every claim in the pitch has a test or a measurement behind it.

| What | How it is checked |
|---|---|
| The rules and views | `npm test` , JS unit suite, plus `node tests/api.integration.js` against a live server |
| The Python model | `PYTHONPATH=ml python -m unittest discover -s ml/tests` , 60 tests across contracts, features, scoring, scenarios |
| The clinical boundary | `analysis/language_guard.py` and its Node port `server/languageGuard.js`, checked for pattern-for-pattern parity; every model sentence passes it before leaving the server |
| The false-alarm rate | 3.35% of subject-days at the shipped 1.75 sd, over the 66 of 71 LifeSnaps subjects with usable baselines (4,420 of 4,453 subject-days). Reproduce with `python3 analysis/calibrate.py fixtures/lifesnaps_daily.csv --sweep`; the grid is `fixtures/calibration.json` |
| How fast it speaks when it should | a coordinated deviation of known size injected onto 41 real subjects' own series. Over the same window the rule fires for 70.7% of them untouched, median five days; at 2.0 personal sd it fires for 97.6%, median **one** day. The gain is in the lag, not the rate (`analysis/sensitivity.py`, `fixtures/sensitivity.json`) |
| Which baseline that is measured against | 3.35% uses a whole-series baseline, which includes the day being judged; the trailing baseline `detect.py` actually uses fires on 6.04%. Both are in `fixtures/calibration.json` and `docs/DATA.md` says which to quote for what |
| Whether the model earns its place | both detectors over the same injected change: the rule is the sensitive one (97.6% at 2.0 sd, one day), the model the quiet one (56.1%, but speaking on 9.8% of untouched subjects against the rule's 53.7%). A second opinion, not a better detector (`analysis/sensitivity_ml.py`) |
| The model against the rule | 3.77%–5.77% of judged subjects across the five programs this cohort can supply, 5.77% for `post_abdominal_surgery` (`fixtures/ml_calibration.json`); the two use different denominators and are never compared as if they were one |
| The model's cold start | every one of the 14 programs has a synthetic-only prior in `ml/artifacts`, trained by `ml/relay_ml/train.py` on populations drawn from that program's own core metrics, so a patient with days of history is scored rather than refused |
| Detection on gait | one real person's 1,451 days of phone gait, thirty injected episodes: the rule sees a 2 sd coordinated decline the next day; the model catches 77–90% of them and speaks on a tenth as many untouched episodes (`analysis/sensitivity_gait.py`, `fixtures/sensitivity_gait.json`) |
| Real data | 99 days of one team member's wearable physiology and 1,451 days of their phone's gait, de-identified with HMAC pseudonyms and interval-preserving date shifts; raw exports are never committed (`docs/DATA.md`) |

Thresholds are demo settings and are labelled so in the interface. None of this is clinical validation, and the documents say that where it matters.

One limit is worth stating plainly, because it is the first thing a clinician
asks. Nobody in the reference cohort deteriorated after a discharge, so there
is no positive class to count. The detection figures above are measured by
adding a deviation of known size and known start to real people's own
recorded variation, which shows whether the rule can see a coordinated change
through one person's ordinary noise, and how fast. It does not show that the
injected shape is what deterioration looks like, or that catching it prevents
a readmission. Both need a monitored post-discharge cohort with recorded
outcomes, which is the next piece of work rather than a setting we can tune.
