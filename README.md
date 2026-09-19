# Vesper — real-data ingestion and validation

Bay Hacks 2026 — Nucleate Florida Healthcare Challenge.

This branch holds the real-wearable ingestion pipeline and the validation work
that goes with it. The application itself lives on `feat/relay-initial-mvp`.

A provider-facing out-of-hospital monitoring platform that turns fragmented
remote-health data into a patient-specific, auditable statistical evidence
summary for clinician review.

It is **not** a diagnostic, risk-prediction, treatment-recommendation, or
autonomous escalation product. A clinician retains all medical judgment.
See [first build.md](first%20build.md) for the full scope and the system
boundary this codebase is built to respect.

## Quick start

```bash
# unzip an Apple Health export into data/raw/ first
./run_pipeline.sh data/raw/apple_health_export/export.xml
```

Produces `data/daily_deid.csv` (de-identified daily aggregates) and
`data/evidence.json` (statistical evidence objects). Takes ~90 seconds on a
284MB export. Python 3.9+, no third-party dependencies.

## Layout

```
pipeline/
  parse_export.py    Apple Health XML -> normalized event stream
  aggregate.py       events -> one row per patient-day
  deidentify.py      pseudonymous id + interval-preserving date shift
analysis/
  baseline.py        per-patient, per-signal trailing baselines
  detect.py          coordinated deviation -> statistical evidence object
  language_guard.py  enforces the doc's system boundary on generated text
  to_relay_events.py aggregates -> shared/engine.js event contract
data/
  daily_deid.csv     committed, de-identified
  evidence.json      committed, detector output
  relay_events.json  committed, engine-contract replay input
  raw/               gitignored, put the export here
docs/
  DATA.md            data inventory, coverage, findings, privacy handling
  INTEROP.md         running shared/engine.js on real data, and what breaks
  TEAM-NOTE.md       the three competing plans and how they reconcile
```

## Status against the rest of the repo

`feat/relay-initial-mvp` has the working application: Express server, React
dashboard, Render Workflows, ElevenLabs voice agent, FHIR export. This branch
does not duplicate it. It supplies real data to test it against, and it
documents what happened when we did.

Headline: the shared engine returns `quiet` on real wearable data, because its
baseline gate assumes 6-hourly sampling and real wearables report daily. See
[docs/INTEROP.md](docs/INTEROP.md) for the numbers and the one-line fix.

## How detection works

A day is surfaced when at least 2 signals sit beyond 1.5 standard deviations
of that patient's own trailing baseline, computed excluding the day under test
so a large deviation cannot inflate the baseline it is measured against.
Single-signal excursions are ignored on purpose: one high reading is noise,
several systems moving together is a pattern.

Every evidence object carries the numbers behind it — value, baseline mean and
sd, observation count, z-score, percent delta, data-quality notes and
provenance — so any downstream statement is traceable to the measurement that
produced it.

When signals are missing, the object is marked `context_incomplete` and a
check-in is requested rather than a clean finding reported. "Nothing else
moved" and "we could not see whether anything else moved" are different
answers and the system says which one it has.

## Data

99 days of continuous physiology from an Amazfit Helio Strap contributed by a
team member, plus 4 years of phone activity. Consented first-party data, not
patient data. Raw exports are never committed; only de-identified aggregates
ship here. See [docs/DATA.md](docs/DATA.md).

The demo patients stay synthetic — a healthy 19-year-old cannot demonstrate
day 6 after abdominal surgery. Real data's job is validating that the
thresholds survive contact with a real wrist.
