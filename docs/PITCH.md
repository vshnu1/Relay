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
  personal standard deviations is seen the day after it starts, where the same
  person's own noise takes five. Say it as speed, not as a catch rate. Over a
  fortnight the rule fires for most healthy subjects eventually; what the
  measurement shows is that a real change is seen sooner, and a thirty-day
  readmission window is a race, not a coin toss.
- **If a judge asks whether personal baselines are established practice**, the
  answer is yes, and it helps rather than hurts. A 2024 review in the Journal
  of Personalized Medicine found 78.5% of wearable-ML studies already
  personalise to the individual, and Jeppesen et al. measured a **31%
  reduction in false alarms** from a patient-adaptive model on wearable ECG.
  Relay is not claiming the idea. It is claiming the idea applied to the
  thirty days after a discharge, which that review does not cover anywhere in
  its 21 pages. Related work is in [DATA.md](DATA.md). Do not quote their
  accuracy figures beside ours: theirs are classification accuracies on
  curated sets, ours is a false-alarm rate per subject-day and a detection
  lag, and the two answer different questions.
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

Say what we measured, how, and what we did not. On 71 real wearable subjects
with nobody deteriorating, the rule fires on **3.35%** of subject-days at the
shipped 1.75 sd — but that is measured against a baseline built from a
subject's whole series, which includes the day being judged. Judged only
against the days before it, which is all a deployment has, it is **6.04%**.
Both are in `fixtures/calibration.json` and we quote them separately, because
quoting the first as the second overstates us by nearly half.

For the other half: a coordinated change of two personal standard deviations
is seen **the next day**, against five days for the same person's own noise.
Say it as speed, not as a catch rate — over a fortnight the rule fires for
most healthy subjects eventually; what the measurement shows is that a real
change is seen sooner, and a thirty-day readmission window is a race.

**Sensitivity is unmeasured and we say so.** Nobody in the reference cohort
deteriorated after a discharge, so there is no positive class to count.

*Volunteering the 3.35-vs-6.04 distinction before anyone asks is the single
most credible thing in this pitch. It is the move of a team that measured
carefully rather than one that found a good number.*

**"Is this a regulated device?"**

*Probably yes, and say so first.* Clinical decision support is exempt under
FD&C Act 520(o)(1)(E) only if all four criteria hold, and we fail the first:
it excludes software that analyses a pattern from a signal acquisition system,
and reading a wearable stream and requiring 24 hours of persistence is exactly
that. The language guard keeps us clear of Criteria 3 and 4 — it is checked at
runtime on every generated sentence — but it does not move us outside the
definition. The full walkthrough is `docs/FDA.md`, and the concession is in it
in writing.

A reviewer who knows this area reaches Criterion 1 within a minute of
understanding what we ingest. Conceding it is worth more than a claim that
does not survive the first question.

**"What about security and HIPAA?"**

Open the **Security** tab in the clinician view. It renders the HIPAA Security
Rule's technical safeguards cite by cite: four built, one partial, **five not
met**, with the failures named — unique user identification, emergency access,
encryption at rest, stored-data authentication, person authentication. Beside
it is the audit trail, live, showing the acting role on every access.

Then say the thing that is not on the screen: this is not a compliant system
and cannot be, because compliance is agreements, risk analyses and trained
staff. `docs/COMPLIANCE.md` also answers which law would even apply, which
changes with the business model — a hospital contract makes this a HIPAA
business associate, selling to patients directly makes it an FTC Health Breach
Notification Rule vendor instead, and Washington's My Health My Data Act
reaches either with a private right of action.

**"Where does the patient's data go?"**

Nowhere. The Apple Health export inflates and parses **in the browser** — 284
MB, 852,000 records, never uploaded, and no third-party model sees it. The one
path that leaves our origin is the voice check-in: restricted to synthetic
patients, and it carries no name and no free text. The typefaces are served
from our own origin too, so not even a font request tells anyone who opened a
record.

*Staff reaching for tools without knowing where the data goes is the named top
risk in this field. This is that claim demonstrated rather than asserted.*

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

Making a clinical claim would need IRB review, a prospective cohort, and
reporting against the standard matching the design — TRIPOD+AI for a
prediction model, DECIDE-AI for early live evaluation. Naming the path is the
answer; claiming to be on it would not be.

**"Is any of this new?"**

Personal baselines are established practice and that helps us. A 2024 review
in the Journal of Personalized Medicine found 78.5% of wearable-ML studies
already personalise to the individual, and Jeppesen et al. measured a **31%
reduction in false alarms** from a patient-adaptive model on wearable ECG. We
are not claiming the idea. We are claiming it applied to the thirty days after
a discharge, which that review does not cover anywhere in its 21 pages — which
is also why there was no external benchmark and we had to produce the numbers
ourselves.

Do not quote their accuracy figures beside ours: theirs are classification
accuracies on curated sets, ours is a false-alarm rate per subject-day and a
detection lag. They answer different questions.

**"If a cancer centre asked about oncology?"**

The post-chemotherapy program is already in the demo: temperature, resting
heart rate, heart rate variability and breathing counted, with fever and
mouth-sore questions — the neutropenic-fever watch. Grace Adebayo and Victor
Lindqvist are discharged from Moffitt, Malignant Hematology. Open Grace.

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
thresholds and no rules, it ranks 2027-04-11 **first of 45** at -0.675,
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
