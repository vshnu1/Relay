# Data inventory

## Source

One team member (Anson) contributed 4 years of personal Apple Health data,
including 99 days from an Amazfit Helio Strap synced through Zepp. This is
consented first-party data from a team member, not patient data.

**The raw export is never committed.** It is gitignored. Only de-identified
daily aggregates ship in this repo. See "Privacy handling" below.

## Coverage

Wrist wearable, 12 Jun 2026 to 18 Sep 2026 — 99 calendar days, 91 with data,
8 gaps:

| Signal | Records | Days | Density |
|---|---|---|---|
| Heart rate | 347,476 | 91 | ~1/min continuous, median 1,423/day |
| Respiratory rate | 26,537 | 72 | ~368/day |
| Blood oxygen | 7,949 | 88 | ~90/day |
| Sleep stages (deep/REM/core/awake) | 1,661 | 68 nights | per-stage episodes |
| HRV (SDNN) | 193 | 66 | ~3/day, sparse |
| Resting heart rate | 54 | 54 | 1/day, 54 of 99 days |

Phone, 4 Sep 2022 to 18 Sep 2026 — 1,463 days of steps, distance, flights,
walking speed, step length, gait asymmetry, double-support percentage, and
active/basal energy.

## What is not in the data

No blood pressure, cholesterol, HDL, glucose, medications, or any lab value.
Body mass appears 4 times in 4 years. Height once.

This rules out population risk calculators as a demo path. Framingham needs
total cholesterol, HDL, systolic BP, smoking and diabetes status — none are
present and a wrist strap cannot produce them. Framingham is also validated
for ages 30 to 74, and the contributing subject is 19, so the model is out of
range regardless of inputs.

The data supports personal-baseline deviation detection, which is what the
architecture in `first build.md` actually calls for, and which has no age or
lab dependency.

## Events found in the real data

Running `analysis/detect.py` over the de-identified aggregates surfaces 6 days
where 2+ signals exceed 1.5 sd of the subject's own trailing baseline. Dates
below are the shifted de-identified dates as they appear in `fixtures/evidence.json`.

**Study day 1413 — coordinated deviation, all signals present.**
Resting HR 78 bpm against a personal baseline of 58.9 (+4.19 sd, +32.5%).
HRV suppressed to 38.6 ms from a baseline of 56.5 (-1.98 sd). Nocturnal HR
97 bpm against 70.6 (+1.57 sd). Three systems moving together on one day,
returning to baseline within two days.

None of those values is abnormal in absolute terms — a resting heart rate of
78 is unremarkable. It is only a signal relative to this individual. That is
the entire argument for the product, demonstrated on real data.

Step count that day was roughly double the surrounding days, so the likely
resolution is exertion. That makes it a good demo of the check-in loop
*closing* an event rather than escalating it.

**Study day 1404 — incomplete context.**
SpO2 96.95% (-3.42 sd) with nocturnal HR 99 bpm (+1.71 sd), but resting HR
and HRV have no reading that day. The engine emits `context_incomplete` and
requests a check-in rather than reporting a clean finding. This is the
data-quality branch of the architecture, hit by real missing data rather
than a simulated gap.

## Privacy handling

`pipeline/deidentify.py` applies the standard research approach before
anything is committed:

- pseudonymous patient id via HMAC-SHA256 under a secret that is not in the repo
- a consistent per-subject date shift, so intervals and weekday structure
  survive but no real date does
- a `study_day` index, which is what the analysis layer actually consumes
- source and device strings collapsed to a device class

HIPAA Safe Harbor treats any date element more specific than a year as an
identifier, which is why the shift is applied rather than the dates simply
being kept. The shift is consistent per subject rather than per row because
the detector reasons about persistence across consecutive days; independently
jittered dates would destroy that.

Set `DEID_SECRET` in the environment for any run whose output leaves a laptop.
The default is a development placeholder and the tool warns when it is used.

## Reproducing

```bash
# unzip the Apple Health export into data/raw/ first
./run_pipeline.sh data/raw/apple_health_export/export.xml
```

Roughly 90 seconds end to end on the 284MB export. Intermediates
(`data/events.csv`, `data/daily.csv`) are gitignored; `fixtures/daily_deid.csv`
and `fixtures/evidence.json` are the committed outputs.
