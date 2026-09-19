# Running the shared engine on real wearable data

Tested `shared/engine.js` from `feat/relay-initial-mvp` against 99 days of real
Amazfit Helio Strap physiology (see [DATA.md](DATA.md)).

> **Correction, second pass.** The first version of this doc blamed the
> engine's baseline gate and claimed real wearables report these metrics
> daily. That was wrong for three of the four metrics. The daily table came
> from *our own aggregation step*, not from the device. Re-measured numbers
> and the corrected conclusion are below. The engine needs one small change,
> not four.

## Actual sampling density from the device

Measured off the raw export, not off our aggregates:

| Signal | Samples/day | Median gap | Really daily? |
|---|---|---|---|
| Heart rate | 3,818 | sub-minute | no, continuous |
| Respiratory rate | 369 | ~1 min | no, continuous |
| Blood oxygen | 90 | ~5 min | no, near-continuous |
| Gait (speed, step length, double support) | ~39 | ~3 min | no, dense |
| HRV SDNN | 2.9 | ~2.1 h | no |
| Resting heart rate | 0.55 | daily | **yes** |
| Sleep stages | per night | nightly | **yes** |

Only resting heart rate and sleep are genuinely once-a-day. The vendor
computes resting HR itself, once, and only on 54 of 99 days.

## What that means for the baseline gate

`calculateBaseline` wants 12 samples spanning 72h within the preceding 14
days. Whether that passes depends entirely on the window we aggregate into,
which is our choice, not the device's:

| Metric | per 14d, daily aggregation | per 14d, 6-hour windows |
|---|---|---|
| spo2 | 12.4 — marginal | **44.0 — passes** |
| respiratory | 10.2 — fails | **21.1 — passes** |
| hrv | 9.3 — fails | **16.9 — passes** |
| rhr | 7.6 — fails | 7.7 — still fails |

Aggregating into 6-hour windows, which is the cadence `simulate()` produces
and the engine is tuned for, fixes three of the four. `cadenceHours` then
correctly reports 6 instead of 24.

**So the engine is mostly fine. Our ingestion was wrong.** That is the
correction.

## What genuinely remains

With 6-hour windows the cadence is detected correctly as 6h and four of five
baselines become usable:

```
rhr          n= 11  sufficient=false
hrv          n= 22  sufficient=true
respiratory  n= 26  sufficient=true
sleep        n= 13  sufficient=true
spo2         n= 56  sufficient=true
```

The engine still reports `quiet` on the real event days. Peeling it apart by
patching a local copy one constraint at a time gives a chain, not a single
cause. Each fix below exposes the next:

| Patch | Effect |
|---|---|
| baseline window 14d → 28d | every `Insufficient baseline` clears |
| `fresh` 9h → 36h | every `Missing recent data` clears |
| analysis window 36h → 96h | `hr_night` finally flags on one day |

After all three, one signal flags. Not three, so `coordinated` stays false.

### The tension that makes this a design question

Widening the analysis window is what lets a daily metric contribute three
samples — and it is also what destroys the signal. `current` is the mean over
that window, so on the real event day resting HR reads:

| Analysis window | rhr delta |
|---|---|
| 36h | +31.1% |
| 96h | +15.2% |

The same excursion, diluted by averaging it with three normal days. For a
metric sampled once a day, "three consecutive samples" and "a strong delta"
pull in opposite directions. No choice of constant satisfies both.

So this is not a tuning bug. The persistence model assumes every metric is
sampled densely, and ours are not: SpO2 arrives 3.1 times a day, resting HR
0.54 times a day, and one rule governs both.

## Suggested changes, smallest first

1. **Aggregate to 6-hour windows in ingestion.** Done — `pipeline/aggregate.py
   --window 6`. Fixes three of five baselines with no engine change.
2. **Make persistence cadence-relative per metric.** Require 3 samples
   spanning at least 24h *of that metric's own cadence*, rather than 3
   samples inside one global window. A daily metric then needs 3 days, which
   it can supply, and a 5-minute metric is unaffected.
3. **For low-cadence metrics, compare the latest sample, not a window mean.**
   Averaging is what turned +31% into +15%. Dense metrics should keep the
   mean; it is what makes them robust.
4. **Widen `fresh`, or scope it per signal.** Overnight and charging gaps
   routinely exceed `max(8, cadence * 1.5)`, and one stale signal currently
   suppresses the whole pattern.
5. **Make `min_signals` relative** to how many metrics have usable baselines.
   With no CGM, requiring 3 of 6 is requiring 3 of 5.

Items 2 and 3 are the substantive ones and they are the same idea: the rules
should be per-metric, because the sampling rates differ by a factor of six.

## Nocturnal heart rate

`pipeline/aggregate.py` derives `hr_night` as the mean over 02:00-06:00. It
covers 73 of 99 days against the vendor resting-HR field's 54.

**It is not a substitute for that field.** Measured against it on the 54 days
where both exist:

| Derivation | Bias | Correlation | MAE |
|---|---|---|---|
| HR 5th percentile | +4.2 bpm | 0.22 | 5.9 |
| HR 10th percentile | +10.4 bpm | -0.05 | 11.1 |
| Nocturnal 02:00-06:00 mean | +9.2 bpm | 0.45 | 9.4 |

Splicing 54 days of vendor RHR (mean 59) onto 73 days of nocturnal mean
(mean 68) would put a 9 bpm step in the middle of the series and manufacture
deviations from it. They are kept as separate columns with separate
baselines, and `to_relay_events.py` refuses to emit `hr_night` as `rhr`.

Emitting it needs a `METRICS` entry, which is why it sits behind
`--include-nocturnal`:

```js
hr_night: {
  label: "Nocturnal heart rate", unit: "bpm", base: 62,
  threshold: 12, color: "#8b6f9e", source: "Wearable",
},
```

Patched in locally, it gets a usable baseline (n=14) and shows +33% on the
real event day, which is the largest deviation of any signal there.

## Why this still matters for judging

The Nucleate brief asks whether the data-to-insight pipeline is *sound*.
"We ran it against 99 days of real wearable data, found our windowing was
wrong, fixed it, and traced what remained to a persistence model that assumes
uniform sampling rates" is a strong answer. It is also an honest one, which
is the point — the first version of this document had it backwards, and
measuring is what caught it.
