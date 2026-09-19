# Pitch

Spoken pitch, submission copy, and the answers to the questions that will
actually get asked. Numbers here come from [DATA.md](DATA.md) and
`fixtures/calibration.json`. If you change a threshold, change it here too.

Two claims in this document are **conditional** and marked `[VERIFY]`. Do not
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
- **End on the boundary.** In a health pitch it reads as judgement, not as a
  limitation, and it is the line that most reliably earns the next two minutes.

---

## The two-minute pitch

Timings are measured, not estimated: 2.68 words per second, the pace of the
thirty-second version. Every beat is within a second of its label. Total
**2:07**; dropping the sentence marked `[CUT FIRST]` gives **2:04**.

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

**The product — 35 seconds**

> Relay puts every signal on one timeline against that patient's own baseline,
> and looks for changes that move together and persist.
>
> When the data is ambiguous, it does something most monitoring tools cannot:
> it asks. A short consented check-in collects what no sensor can measure — did
> you exercise, has your pain changed, did you miss a dose. Those answers come
> back as structured fields, the analysis runs again, and the clinician gets one
> evidence packet: what changed, by how much, over how long, what the patient
> said, and every timestamp behind it.
>
> *[demo: Alex Morgan, Context needed → check-in → Ready for review]*

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
- Render Workflows: ingest → baseline → deviation → context request → compile `[VERIFY]`
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

### The two `[VERIFY]` claims

| Claim | True when | Current |
|---|---|---|
| "Render Workflows runs the analysis" | a workflow has executed on Render | `/api/status` → `render:false`; never executed |
| "A live ElevenLabs voice check-in" | a real conversation has completed | `/api/status` → `voice:false`; key unset, untested |

Both fall back cleanly — analysis runs on the local engine, the check-in
offers a working text form. **If they are still false at demo time, present
the text check-in as the check-in and do not mention voice.** A judge who
hears "voice" and sees a form will discount everything else you said.

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
