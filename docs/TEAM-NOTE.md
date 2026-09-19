# Anson — real data, and three plans that need reconciling

Friday night. Three things landed within about 40 minutes of each other:
Vishnu's working MVP on `feat/relay-initial-mvp`, the Relay spec, and this
branch. They do not currently agree. Fastest path is to decide the conflicts
explicitly rather than let them surface at 4am.

## What I brought

99 days of real continuous physiology from an Amazfit Helio Strap I am
wearing, plus 4 years of phone activity. 347k heart-rate samples at roughly
one per minute, respiratory rate, SpO2, and staged sleep across 68 nights.
Full inventory and privacy handling in [DATA.md](DATA.md).

A working ingestion pipeline: Apple Health export to normalized events to
patient-days to de-identified aggregates, plus a reference detector. Run
`./run_pipeline.sh`, about 90 seconds, no dependencies beyond Python 3.9.

`pipeline/to_relay_events.py` emits the exact event contract `shared/engine.js`
validates, so real data can be replayed through the engine we already have.

## The finding that matters most

**I ran Vishnu's engine against the real data. It returns `quiet` on every
window, including the days with a clear multi-signal deviation.**

Not a tuning issue. `calculateBaseline` requires 12 samples spanning 72 hours
within the preceding 14 days. The synthetic generator emits every 6 hours, so
14 days gives 56 samples and the gate sails through. Real wearables report
these metrics roughly once a day, and not every day — resting HR appears on 55%
of days, HRV on 67%. In a 14-day window that is 7 to 9 samples, under the
minimum of 12. Every metric except SpO2 is permanently gated off, so
`coordinated` can never become true regardless of physiology.

Numbers, the coverage table that predicts the output exactly, and four
suggested fixes (smallest is a one-line change) are in [INTEROP.md](INTEROP.md).

This is worth *keeping in the pitch*, not hiding. "We ran it against 99 days
of real data, found the sampling assumption, fixed it" answers the Nucleate
soundness criterion far better than a demo that only ever saw its own
generator.

## The three conflicts

**1. Stack. Relay says FastAPI + Render Postgres. The MVP that exists is
Express + Node 22, with Render Workflows already wired, tests passing, and a
FHIR bundle exporter.**

With roughly 20 hours left, rewriting a working backend into another language
is the single most dangerous move available to us. My vote: keep Express,
adopt everything else from Relay. If we want Python for the model, run it as
a sidecar the workflow calls, not as a replacement backend. Vishnu owns this
call as integration lead.

**2. Model. Relay says Isolation Forest. The MVP has deterministic percent
thresholds. I built z-scores against a personal baseline.**

All three are defensible. Isolation Forest on 6-9 features with one patient's
history is not obviously better than z-scores and is harder to explain on
stage, which matters because explainability is the product. Suggestion: keep
the deterministic rule as the thing that decides, add the model as a second
opinion shown alongside if there is time. That also preserves the doc's
auditability claim — an Isolation Forest score is not traceable to a
measurement the way a z-score is.

**3. Real versus synthetic data. Relay says do not build device
integrations and use synthetic data.**

That instruction is right about where to spend time, and the integration cost
is already paid, so the tradeoff has changed. But it is also right about the
demo: our scenario is day 6 after abdominal surgery, and a healthy 19-year-old
cannot demonstrate that. Maya has to be synthetic.

So real data should not be the demo. It should be the **validation layer** —
the thing that proves our thresholds survive contact with a real wrist, and
the answer when a judge asks "would this work outside your simulator?" We
already have one concrete finding from it. That is the right role for it and I
am not arguing for more.

## Repo structure

Relay proposes `apps/web`, `apps/api`, `packages/contracts|ml|voice`. The MVP
is flat: `server/`, `src/`, `shared/`, `workflows/`. Moving files costs merge
pain for zero judging points. Suggestion: keep flat, add `packages/ml/` only
if the model lands.

If we do adopt worktrees, my pipeline slots under the ML/data role without
moving.

## What I can pick up

Happy to take ML/Data. Concretely: synthetic post-surgical patient generator
whose signal cadence and missingness match what the real export actually looks
like, so the synthetic patients are not unrealistically clean. The real data
gives us empirically grounded gap rates instead of guessed ones — a synthetic
patient with a reading every 6 hours is a tell.

## Two asks

- **Vishnu:** `first build.md` is truncated. It cuts off mid-diagram right
  after "statistical evidence object". The tail covering AI synthesis, the
  check-in flow and the EHR handoff never made it. Can you repush?
- **Everyone:** the baseline gate in `shared/engine.js` is a real blocker for
  any non-synthetic input. Whoever owns the engine, INTEROP.md has the fix.

## The boundary is enforced in code now

`analysis/language_guard.py` turns the allowed/forbidden phrasing list from
`first build.md` into a check that runs. Relay repeats the same constraint
("avoid labels such as safe, healthy, emergency, or sepsis detected"), so this
applies to both plans.

```
$ python3 analysis/language_guard.py "Resting heart rate is 14% above the patient's baseline for 36 hours."
pass — no boundary violations

$ python3 analysis/language_guard.py "The patient has an infection and is at high risk of deterioration."
fail — 3 violation(s)
  diagnostic claim            'has an infection'
  risk prediction             'high risk'
  risk prediction             'risk of deterioration'
```

Whoever writes the ElevenLabs prompt and the summary renderer: pipe model
output through `enforce()` before it renders. This constraint is easy to
violate by accident and it is the thing that keeps us out of regulated
territory.

## One free win

The Apple Health export ships `export_cda.xml` — real HL7 CDA R2 with LOINC
codes and proper OIDs. The MVP already emits a FHIR bundle, which covers the
handoff requirement well. CDA is only worth grabbing if someone wants a second
format cheaply; FHIR is the better choice and it is already done.

## What I did not build, and why

I came in wanting to compute cardiovascular, diabetes and Alzheimer's risk
scores from the strap and generate mitigation plans. Having looked at the real
data I dropped it, and I think both specs are right to exclude it:

1. The inputs do not exist. Framingham needs total cholesterol, HDL, systolic
   BP, smoking and diabetes status. None are in the export and no wrist strap
   produces them.
2. Framingham is validated for ages 30 to 74. I am 19, so the model is out of
   range for the only real subject we have and would output roughly zero.
3. It is the WHOOP / InsideTracker product, and "not clones of existing
   products" is a stated judging criterion.
4. Both `first build.md` and Relay explicitly rule out risk prediction and
   treatment recommendation.

Personal-baseline deviation detection has no lab or age dependency and gets
stronger with more days. The data points at the plan we already have.
