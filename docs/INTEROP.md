# Running the shared engine on real wearable data

Tested `shared/engine.js` from `feat/relay-initial-mvp` against 99 days of real
Amazfit Helio Strap physiology (see [DATA.md](DATA.md)). Reproduce with
`pipeline/to_relay_events.py`, which emits the engine's exact event contract.

## Result

The engine returns `state: quiet`, `coordinated: false` on every window,
including the three days where a personal-baseline detector finds a clear
multi-signal deviation.

```
=== window ending 2026-10-15 (the real coordinated deviation) ===
state=quiet coordinated=false flaggedSignals=[]
  rhr          delta=  12.9% thr=10% flagged=false Insufficient baseline
  hrv          delta= -17.6% thr=15% flagged=false Insufficient baseline
  respiratory  delta=   4.5% thr=10% flagged=false Insufficient baseline
  sleep        delta=  -2.6% thr=15% flagged=false Insufficient baseline
  spo2         delta=   0.2% thr= 3% flagged=false Available
```

Note that rhr and hrv both clear their percent thresholds. They are still not
flagged, because `flagged` requires `b.sufficient` and the baseline gate fails.
This is not a tuning problem, it is a structural one.

## Root cause: the baseline window assumes sub-daily sampling

`calculateBaseline` requires **12 samples spanning 72 hours inside the
preceding 14 days**. The synthetic generator in `simulate()` emits every 6
hours, so 14 days yields 56 samples per metric and the gate passes comfortably.

Real consumer wearables report most of these metrics **once per day**, and not
every day. Observed coverage over 99 days:

| Metric | Days present | Coverage | Expected samples in a 14-day window |
|---|---|---|---|
| spo2 | 88 | 89% | 12.5 — passes, barely |
| respiratory | 72 | 73% | 10.2 — fails |
| sleep | 67 | 68% | 9.5 — fails |
| hrv | 66 | 67% | 9.4 — fails |
| rhr | 54 | 55% | 7.7 — fails |

That table predicts the output exactly: spo2 is the only metric reporting
`Available`, and it is the only one clearing 12 samples. Every other signal is
permanently gated off, so `coordinated` can never become true no matter what
the patient's physiology does.

## Two smaller mismatches

**The 3-signal rule.** `coordinated` needs 3+ flagged signals with 24h of
shared overlap. The real event moves resting HR, HRV and nocturnal HR together
— but `hr_night` is not in `METRICS`, so only 2 of the 3 are representable.
Real deviations in this dataset are 2-signal events.

**Spike dilution.** `current` is the mean over a 36-72h window. The real event
is a one-day excursion, so averaging it with its neighbours turns +32.5% into
+12.9%. A daily-cadence detector should compare the day, not a multi-day mean
containing the day.

## Suggested fixes, smallest first

1. **Make the baseline window sample-driven, not day-driven.** Take the last N
   observations of each metric regardless of how far back they reach, instead
   of everything inside a fixed 14 days. One-line change, fixes the gate for
   any cadence.
2. **Or scale the window with observed cadence.** `cadenceHours` is already
   computed; `baselineDays = 14 * max(1, cadence / 6)` gives 56 days at daily
   cadence and leaves the synthetic path untouched.
3. **Add `hr_night` to `METRICS`.** Nocturnal heart rate averaged over
   02:00-06:00 is available on 73 of 99 days, against 54 for the vendor's own
   resting-HR field. It is the densest cardiac signal in real exports and it
   moved on every event found.
4. **Lower `min_signals` to 2 when fewer than 4 metrics have usable baselines.**
   Requiring 3 of 6 is reasonable; requiring 3 when only 2 are observable is not.

None of these change the synthetic demo path. They are the difference between
"works on our generator" and "works on data from a real wrist".

## Why this matters for judging

The Nucleate brief asks whether the monitoring approach and data-to-insight
pipeline is *sound*. "We ran it against 99 days of real wearable data, found
where it broke, and fixed the sampling assumption" is a much stronger answer
than a demo that only ever saw its own generator's output. The failure above
is worth keeping in the story, not hiding.
