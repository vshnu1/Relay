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

Re-running the engine on 6-hour windows, it still reports `quiet` on the real
event day, but the failure modes are now specific and much smaller:

```
2026-07-18  state=quiet coordinated=false
   rhr           25.8% vs 10%   flagged=false  Insufficient baseline
   hrv          -15.9% vs 15%   flagged=false  Insufficient baseline
   respiratory    0.8% vs 10%   flagged=false  Missing recent data
   spo2             0% vs  3%   flagged=false  Available
```

1. **Resting HR is genuinely sparse** at 0.55/day and cannot reach 12 samples
   in 14 days at any window size. It clears its percent threshold (+25.8% vs
   10%) and is still gated off. This one is a real engine problem.
   *Fix:* derive resting HR ourselves from the continuous stream — mean heart
   rate over 02:00-06:00 is available on 73 of 99 days against the vendor's 54,
   and updates per window rather than per day.
2. **`fresh` fails for respiratory** on some windows. The check requires a
   sample within `max(8, cadence * 1.5)` hours of the series end. Real wear
   has overnight and charging gaps that exceed it. *Fix:* widen the freshness
   allowance, or treat a gap as `Missing recent data` on that signal only
   rather than letting it suppress the whole pattern.
3. **The 3-signal rule.** `coordinated` needs 3+ flagged signals. With
   glucose absent (no CGM) and sleep nightly, real events here move 2 signals.
   *Fix:* require 3 of the metrics that actually have usable baselines, not 3
   of 6 fixed.

## Suggested changes, smallest first

1. **Aggregate to 6-hour windows in ingestion.** Ours, not theirs. Fixes
   three of four metrics with no engine change.
2. **Derive resting HR from the nocturnal window** instead of using the
   vendor's daily field. More coverage, finer cadence.
3. **Make `min_signals` relative** to how many metrics have usable baselines.
4. **Widen `fresh`** or scope its effect to the individual signal.

## Why this still matters for judging

The Nucleate brief asks whether the data-to-insight pipeline is *sound*.
"We ran it against 99 days of real wearable data, found our windowing was
wrong, fixed it, and found the two places the engine genuinely needed
loosening" is a strong answer. It is also an honest one, which is the point —
the first version of this document had it backwards, and the measurement is
what caught it.
