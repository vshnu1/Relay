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

## Threshold calibration against a real cohort

`fixtures/lifesnaps_daily.csv` holds 4,453 subject-days from 71 LifeSnaps
participants. Nobody in that cohort is post-surgical, so every trigger the
rule produces there is a false alarm — which makes it a false-positive rate.

| Threshold | Fires on | Per patient / 14 days | Keeps the real event |
|---|---|---|---|
| 1.5 sd | 6.92% | 0.97 | yes |
| 1.7 sd | 4.03% | 0.56 | yes |
| **1.75 sd** | **3.35%** | **0.47** | **yes** |
| 1.8 sd | 3.08% | 0.43 | no |
| 2.0 sd | 1.97% | 0.28 | no |

At the original 1.5 sd the rule fired about once per patient per fortnight on
healthy people. For a product whose premise is *fewer* alerts, that is the
number a clinical judge pushes on.

2.0 sd looks better still, but it deletes the only real coordinated deviation
we have: on 2026-10-15 HRV sits at -1.98 sd and drops out, taking the day
from two signals to one. That event is the demo, and it is also the window an
unsupervised model ranks most anomalous — see the corroboration below.

**1.75 sd is the tightest setting that halves the false-alarm rate and still
catches it.** `analysis/detect.py` now uses it. The surfaced events drop from
6 to 5; 2026-11-06 is the one lost.

`MIN_SIGNALS` stays at 2. Requiring 3 scores better on false alarms and
repeats the mistake in [INTEROP.md](INTEROP.md): only about 40 of 71 subjects
have usable baselines for three signals at once, so a 3-signal rule buys
quiet by being unable to fire.

### What this does not establish

This is a false-positive rate with no matching true-positive rate, because no
one in LifeSnaps is deteriorating. Tightening to 1.75 costs sensitivity and
this cohort cannot say how much. We have exactly one known true positive, and
it is what bounds the threshold from above. The honest claim is "we measured
the false-alarm side and tuned against it", not "we validated the rule".

### Between-person spread, the case for personal baselines

| Signal | Subjects | Range across people | Within one person | Ratio |
|---|---|---|---|---|
| Resting HR | 66 | 47.3 – 78.3 bpm | 2.42 sd | 2.8x |
| HRV | 39 | 19.7 – 100.4 ms | 9.47 sd | 1.9x |
| Respiratory rate | 40 | 11.2 – 19.8 /min | 1.00 sd | 2.3x |
| Nocturnal HR | 39 | 48.4 – 77.5 bpm | 4.57 sd | 1.5x |
| SpO2 | 24 | 94.3 – 97.2 % | 0.91 sd | 0.75x |

Resting heart rate spans 31 bpm between people against 2.42 bpm of day-to-day
variation within one. A reading of 74 is a marked excursion for one subject
and unremarkable for another. A fixed "HRV below 30 ms" rule would flag one
participant permanently and never flag another.

**SpO2 is the honest exception.** Its between-person spread (0.68) is smaller
than its within-person variation (0.91), so a population threshold is
defensible for oxygen saturation and personal baselining adds least there. It
is also the thinnest row, 24 subjects. If asked, concede SpO2 — conceding one
of five is what makes the other four credible.

### A naming caveat

LifeSnaps reports HRV as RMSSD; our own export is genuinely SDNN. They are
different measures and their absolute values are not comparable. RMSSD is
written into the `hrv_sdnn` column for schema compatibility and the truth is
recorded in `hrv_measure`. This is safe because the cohort is only used for
within-subject z-scores, where the choice of measure cancels. **Never quote a
LifeSnaps HRV figure as SDNN.**

## A second opinion, from a method with no rules in it

`analysis/detect.py` reaches its answer from per-signal z-scores against a
personal baseline plus a persistence rule. As a cross-check, `analysis/
isolation_forest.py` fits an Isolation Forest on the same windows — no
thresholds, no rules, no notion of a baseline — and asks only which rows sit
furthest from the rest.

It ranks **2026-10-15 first of 45**, score -0.675, ahead of the next window
at -0.597:

```
 rank         date    score   restingHR  hr_night  hrv    resp   spo2
    1   2026-10-15   -0.675       78.00     96.96  23.68  17.14  98.04
    2   2026-11-23   -0.597       57.00    120.10  48.51  16.02  98.90
    3   2026-11-04   -0.588       62.00     64.48  47.31  16.84  97.30
```

Two unrelated methods agreeing on one day is worth more than either alone.
Reproduce it with `python3 analysis/isolation_forest.py` — it needs
scikit-learn, which nothing else here does, and the seed is fixed so the
numbers above come out the same.

**The caveat is the interesting part.** Isolation Forest needs every feature
present, and only **45 of 325 windows (14%)** have all five signals at once,
because each sensor reports at its own rate. The model is starved by
missingness, not by compute — a fit takes 99 ms. That is the argument for
keeping the deterministic rule in charge: it uses whatever signals are
present on the day and says which were missing, where the model simply
discards 86% of the data.

The model stays out of the product for a second reason. An isolation score is
a number without a reason. It cannot be traced to the measurement that caused
it, and traceability is the whole point of the evidence packet. This
corroborates the detector; it does not replace it.

## False-positive rate for the ML engine, measured

`docs/ML.md` reports "0 context_needed over 61 daily points" from one
subject. That is not a false-positive rate: 61 points from one person cannot
estimate one, and it left the model with no figure comparable to the
deterministic rule's 3.35%.

`analysis/calibrate_ml.py` runs the real scoring path over every LifeSnaps
subject. Nobody in that cohort is recovering from surgery, so every state
above `monitoring` is a false alarm.

**Post-abdominal-surgery program, 64 subjects scored:**

| State | Subjects |
|---|---|
| monitoring | 49 |
| insufficient_data | 12 |
| context_needed | 3 |

Judged (excluding `insufficient_data`): 52. False alarms: 3.
**False-positive rate: 5.77% of judged subjects.**

Anomaly scores: median 0.138, p90 0.491, p99 0.822.

Two details worth carrying into the pitch rather than hiding:

**It is not 0%.** The real figure is 5.77% of subjects, against 0 of 61
points reported from a single person. The single-subject number was not
wrong, just far too small a sample to see anything.

**Two of the three false alarms had no flagged signals at all.** The model
fired while the deterministic rule stayed silent. So the model is
contributing false alarms the rule would not have raised — which is the
honest counterweight to the `gait_decline` scenario, where the model catches
a real pattern the rule misses. It trades sensitivity for specificity in both
directions, and now we can say so with numbers.

**Stroke-rehabilitation program, same 64 subjects:** all 64 return
`insufficient_data`. LifeSnaps carries no gait metrics, so the engine cannot
see the signals that program depends on — and reports exactly that rather
than defaulting to `monitoring`. Refusing to judge when it cannot see is the
correct behaviour, and it means the stroke program has no cohort-validated
false-positive rate. Stated, not interpolated.

### Denominators are not interchangeable

The rule's 3.35% is per subject-day; this 5.77% is per subject. A subject
scored once can raise at most one alarm, so the two are not directly
comparable and should never be quoted as though one is better than the other.
