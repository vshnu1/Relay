# Pitch

Spoken pitch, submission copy, and the answers to the questions that will
actually get asked. Numbers here come from [DATA.md](DATA.md) and
`fixtures/calibration.json`. If you change a threshold, change it here too.

One claim in this document is **conditional** and marked `[VERIFY]`. Do not
say them on stage until the thing is true.

---

## The thirty-second version

For the elevator round, the judge who walks up mid-demo, and the answer to
"so what do you do?" 91 words, about 34 seconds at a normal pace. Say it at
that pace — do not speed up to fit more in.

> Hospitals send patients home still recovering, and their watch, glucose
> sensor and oximeter report into separate apps nobody reads. Relay puts them
> on one timeline against that patient's own baseline and flags signals that
> move together.
>
> Across 71 people, resting heart rate baselines span 31 beats — a reading of
> 74 is a marked excursion for one person and a Tuesday for another.
>
> When the data is ambiguous it asks the patient, then hands the clinician one
> evidence packet. It never says what is wrong — that is the clinician's call.

**If they only hear one sentence:**

> Relay watches recovery between visits, and tells a clinician what changed
> for this specific patient — never what it means.

Three notes on delivery:

- **"It asks the patient" — not "voice."** This wording stays true whether or
  not ElevenLabs is live. See [the `[VERIFY]` claims](#the-two-verify-claims).
- **The 31 beats is the hook, not the false-alarm rate.** Thirty seconds only
  buys one number. Lead with the one that makes personal baselines obviously
  necessary; hold 3.35% for when they ask a follow-up, where it lands harder.
  If they push on it, say it is in-sample and give them 6.04%, the trailing
  figure — and then give them the one nobody has: a coordinated change of two
  personal standard deviations is caught in 97.6% of subjects, half of them
  the day after it starts.
- **End on the boundary.** In a health pitch it reads as judgement, not as a
  limitation, and it is the line that most reliably earns the next two minutes.

---

## The two-minute pitch

Timings are measured, not estimated: 2.68 words per second, the pace of the
thirty-second version. Every beat is within a second of its label. Total
**2:11**; dropping the sentence marked `[CUT FIRST]` gives **2:08**.

If your slot hard-stops at 2:00, cut the whole anomaly-model paragraph — it
is the newest material and the only one that survives as a Q&A answer rather
than needing to be said. Everything else is load-bearing.

**The problem — 20 seconds**

> Hospitals are sending patients home earlier than they used to. Those patients
> are still recovering, and generating more health data than anyone is reading
> — a watch, a glucose sensor, a pulse oximeter, all in separate apps. A nurse
> covering forty patients cannot open forty dashboards. So the data exists, and
> nobody looks at it.

**The insight — 29 seconds**

> The useful signal is rarely one number crossing a line. It is several systems
> moving together, relative to what is normal *for that person*.
>
> We measured how much that matters. Across 71 people, resting heart rate
> baselines span 31 beats, while any one person varies by about two and a half
> day to day. A reading of 74 is a marked excursion for one person and a
> Tuesday for another. That is a measurement, not a design opinion.

**The product — 39 seconds**

> Relay opens on one screen, sorted into four states: needs your review,
> waiting on the patient, nothing new, and not enough data. That last one
> matters — it admits when it cannot see, instead of reporting calm.
>
> Open a patient and you get the story, not a chart. Settled by day three.
> Drifting on day seven. All four signals counted for pneumonia past threshold
> together for thirty-eight hours, with no workout recorded to explain it.
> Sleep is down too, and it tells you sleep is not counted here.
>
> When context is missing it asks, and the patient's own words come back into
> the evidence.
>
> *[demo: watchlist → Maya Okafor → day-by-day squares → her check-in answers]*

**The honesty — 29 seconds**

> Two numbers we think you should ask every team for.
>
> We ran our rule against 71 people who were not deteriorating, so every alert
> was a false alarm. We tightened until that halved, and stopped where going
> further would have deleted the one real event we have.
>
> We also built the anomaly model our own spec called for, and it disqualified
> itself — only 14% of our windows carry all five signals. `[CUT FIRST]` The
> rule we shipped uses whatever is present.

**The boundary — 14 seconds**

> Relay never says what is wrong. It says what changed, by how much, and what
> the patient reported. The clinician makes every medical judgment — and that
> constraint is enforced in code, not just in intent.

### Which app the demo shows

Recovery watch, the default at the root URL. Not the earlier workspace, which
now lives at `#/classic`.

That is a change of plan made deliberately: the new interface is better on
every axis this pitch depends on. The four application states are its primary
structure rather than badges on a list, so "nothing new" and "not enough
data" are visible sections a judge can see. It states what it is *not*
counting — sleep is down, and it says sleep is not counted for pneumonia. It
shows which device last synced and when. It covers eight patients across six
recovery programs instead of three synthetic cases. And the patient side
exists, with its own consent and check-in.

The day-by-day squares also tell a longer story than a 36-hour window could:
raised in hospital, settled by day three, diverging from day seven. That arc
is the product's argument, and the earlier timeline could not show it.

What was lost: the dotted baseline line with shaded deviation was more
immediately striking than a green band and a row of squares. If the video
needs one dramatic frame, `#/classic` still has it — but do not cut between
the two on camera.

### What changed and why

The beats used to claim 120 seconds and run 141 — over by a fifth, which in a
hard-stopped slot means being cut off during the boundary line, the one that
earns the most credit. Measured per beat, the insight ran 12 seconds over and
the honesty 10. Both are trimmed to their stated length and every label is
now what it measures. Rehearse against these numbers, not against "two
minutes".

The 86% finding earned its place in the spoken pitch rather than being held
for a follow-up. "We built the model our spec called for and it disqualified
itself on data coverage" is a different claim from "we chose not to" — the
first is a finding, the second a preference, and the soundness criterion is
looking for the first. It needs the words "our own spec called for" to land;
without them, building a model and discarding it reads as indecision rather
than as testing your own plan.

The voice wording stays "a short consented check-in", never "voice", for the
same reason as the thirty-second version.

---

## Submission copy

### Short description

> Relay turns fragmented home-health data into one auditable evidence packet
> for a clinician. It compares wearable, glucose, oxygen, sleep, medication and
> symptom data against each patient's own baseline, detects coordinated
> changes that persist, collects missing context through a consented voice
> check-in, and produces a source-linked review item with a mock FHIR handoff.
> It is decision support: it does not diagnose or recommend treatment.

### What makes it different

1. **Per-patient baselines, measured not assumed.** 71-participant cohort
   shows 31 bpm of between-person spread in resting HR against 2.42 bpm
   within-person. Calibration in `fixtures/calibration.json`.
2. **Coordinated and persistent, not single-threshold.** Two or more signals
   beyond 1.75 sd of that individual's baseline, with persistence required.
3. **A measured false-alarm rate.** 3.35% of subject-days on a
   non-deteriorating cohort, tuned deliberately rather than guessed.
4. **It asks when it cannot tell.** Voice check-in for context sensors cannot
   provide; the packet distinguishes "nothing else moved" from "we could not
   see whether anything else moved".
5. **Auditable by construction.** Every statement traces to a measurement,
   timestamp and device. Audit log on every view, run, check-in and export.

### Technology

- Frontend: React provider portal, synchronized evidence timeline
- Backend: Express API, normalized event store, consent and audit controls
- Render Workflows: ingest → baseline → deviation → context request → compile
- ElevenLabs: consented structured voice check-in `[VERIFY]`
- Mock FHIR: Observation, Communication, Task
- Validation: 99 days of real wearable physiology; 4,453 subject-days from
  the LifeSnaps public cohort (CC-BY-4.0) for threshold calibration

---

## The questions that will get asked

**"How do you know it works?"**

Say what we measured and what we did not. We measured the false-positive side:
4,453 subject-days, 71 people, none deteriorating, 3.35% fire rate at the
shipped setting. We have one known true positive, in real data, and it is what
stopped us tightening further. We do not have a true-positive rate and cannot
claim one. The honest sentence is *"we measured the false-alarm side and tuned
against it."*

**"Isn't this just WHOOP?"**

WHOOP shows a person their own data. Relay does the thing a clinician cannot
do from screenshots: normalizes several sources onto one axis, compares to
that individual's baseline, requires signals to move *together* and persist,
asks the patient when the passive data is ambiguous, and produces one
source-linked packet with an EHR handoff. The output is for the care team, not
the wearer.

**"What happens when it's wrong?"**

It is built to be wrong safely. It never names a condition, so a false alarm
costs a clinician a look at a timeline and costs the patient nothing. Missing
data produces "context incomplete" rather than a clean finding. And the whole
thing is decision support — nothing escalates, nothing is dispatched, no
treatment is suggested.

**"Why not deep learning?"**

Explainability is the product. A clinician needs to see that respiratory rate
was 12% above baseline for two nights. A model score that cannot be traced to
a measurement would fail the one job the output has. The detection rule is
deterministic and printed in the interface.

**"Did you validate on real patients?"**

No, and we say so. Synthetic demo patients, one real non-clinical wearable
dataset for engineering validation, and a public research cohort for
calibration. No PHI, no clinical validation, no HIPAA-compliance claim.

---

## Claims discipline

**Never say:** diagnosis, infection, sepsis, risk of deterioration, high risk,
critical, urgent, emergency, "the patient should be treated", "contact the
patient immediately", or that anything is HIPAA compliant.

**Say instead:** "statistical review trigger", "provider review suggested",
"X% above this patient's baseline for N hours", "context is incomplete",
"built with HIPAA-aligned controls using synthetic data".

Run any new stage copy through the guard before it goes in a slide:

```bash
python analysis/language_guard.py "your sentence here"
```

### Render Workflows — VERIFIED, safe to claim

Executed on Render at 01:4x on 19 September. `/api/status` reports
`render: true`, and the five-stage chain ran in Virginia, not locally:

```
POST /api/patients/demo-01/analyze  →  6.8s
execution: { "mode": "Render Workflows", "id": "trn-0b14gdan29jrm8hqs739pgi5g" }
state: review   coordinated: true
```

Dashboard confirms all six tasks at 1 run, 100% success:
`ingestAndNormalize`, `calculateBaseline`, `detectCoordinatedDeviation`,
`requestContext`, `compileReviewItem`, `monitoringPipeline`.

**Say it plainly.** Show the execution ID or the dashboard — an ID a judge can
see beats a claim they have to take on trust.

Two honest caveats. The round trip is about 7 seconds, so pre-warm it once
before recording rather than triggering it live twice. And the Recovery watch
computes client side and never calls the API — only `#/classic` goes through
the server and therefore through Render. Phrase it as "the analysis runs as a
five-stage Render Workflow, here is the execution", not as though the
watchlist triggered it.

### The one remaining `[VERIFY]` claim

| Claim | True when | Current |
|---|---|---|
| "A live ElevenLabs voice check-in" | a real conversation has completed | `/api/status` → `voice:false`; key unset, untested |

It falls back cleanly to a working text form. **If it is still false at demo
time, present the text check-in as the check-in and do not mention voice.** A
judge who hears "voice" and sees a form will discount everything else you
said.

### Resolved: the Isolation Forest claim now has a source

`analysis/isolation_forest.py` reproduces it. On the same windows, with no
thresholds and no rules, it ranks 2026-10-15 **first of 45** at -0.675,
ahead of the next window at -0.597. Seed fixed, figures in
[DATA.md](DATA.md) come out the same.

**Safe to say on stage.** The honest framing, if it comes up:

> The statistical rule and an unsupervised model, which share no logic,
> pick the same day. The model does not ship — an isolation score cannot be
> traced to the measurement that caused it, and that traceability is the
> product.

If pressed on why it does not ship, the real answer is better than the
diplomatic one: only 45 of 325 windows carry all five signals at once, so
the model discards 86% of the data. The deterministic rule uses whatever is
present that day and reports what was missing.
