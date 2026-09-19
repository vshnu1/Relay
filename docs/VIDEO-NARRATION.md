# Read this out loud

Lines in _[square brackets]_ are for whoever drives the app. Do not read them.

**538 words, about 3 minutes 20 spoken.** Devpost wants 2 to 3 minutes, so three
sentences are marked **(cut for 3:00)**. Drop all three and you land at 3:00
with every topic still in. Decide before you record, not during.

---

## The problem · 0:00–0:25

_[Landing page. Slow scroll. Do not click during this section.]_

In healthcare, the hardest person to watch is the one who has gone home. The
thirty days after a discharge are when a patient is most likely to come back,
and when the line to their care team goes quiet. They do not know what is
worth a phone call. The clinician has forty of them. And the watch on that
wrist records the whole time, unread.

> **(cut for 3:00)** the last sentence, "And the watch on that wrist records the
> whole time, unread."

---

## What it does with the data · 0:25–0:55

_[Click "I have a discharge code". Bayfront Health, BAY-2741. Land on the
patient home, point at the four readings.]_

Relay turns that stream into something a clinician can act on. It cuts every
signal into six-hour windows, compares each with that patient's own baseline
rather than a population range, and speaks only when several move together and
stay moved for a day.

_[Check-in tab. Start the voice check-in, answer one question, point at the
draft.]_

Then it does what most monitoring gets wrong. It does not alarm. It asks. This
is an ElevenLabs agent, and the questions come from the discharge plan, so
pneumonia asks about breathing and fever. Nothing reaches the care team until
the patient approves it.

---

## Why a hospital cares · 0:55–1:20

_[Clinician tab. Ward list. Point at each of the four state cards.]_

That is the point for a hospital. Twenty-eight patients, and today two need a
clinician. Not twenty-eight charts, two. Twelve are waiting on a check-in, and
two the system admits it cannot see well enough to judge. Medicare penalises
six conditions on a thirty-day readmission window; four are already pathways
here.

> **(cut for 3:00)** the last sentence, the Medicare one. Keep it if any judge
> has asked about reimbursement.

_[Open Maya Okafor. Down the left summary, then her own words. Then point at
"Listen to summary".]_

Open one and you get the story, not a chart. Drifting on day seven, four
signals past threshold together for thirty-five hours, and her own words
beside the numbers. There is a spoken version too, our second use of
ElevenLabs, for a clinician between rooms.

---

## The model, and why it stayed quiet · 1:20–2:00

_[Model view. Stop on the score.]_

A second model runs beside that rule: an Isolation Forest, unsupervised,
because nobody in our reference data deteriorated, so there was never a
positive class to train on. It learns this patient's own windows and scores
how far today's sits from them.

_[Scroll slowly through "why it stayed quiet" so all four gates are readable.
Hold this shot the longest in the video.]_

And look what it did. It scored above its own line, so the model alone would
have spoken. It stayed quiet because the coordination gate failed, and it
shows you that rather than hiding it. A product that tells a clinician why it
said nothing is doing the harder half.

_[Render dashboard tab, most recent run. Point at the execution ID.]_

All of it runs as a Render Workflow, every time a check-in starts or a
clinician analyses a case, and every run has an execution ID that any number
on screen traces back to.

---

## Where the data goes · 2:00–2:45

_[Back to the app. Patient side, "Your data", the Health import panel.]_

Where does the data go? That Apple Health import is 284 megabytes, parsed
entirely in the browser. Nothing uploaded, no third-party model sees it. Staff
reaching for tools without knowing where data goes is the top named risk in
this field. This is that claim demonstrated.

_[Clinician side. Security in the sidebar. Point at the two green "Live:"
lines, then at a row of the audit trail.]_

Every technical safeguard in the HIPAA Security Rule, cite by cite. Nine
built, one partial. Two read from the running process rather than asserted:
whether the data is really encrypted, and whether the audit log verifies.
Every access names a person.

> **(cut for 3:00)** the sentence beginning "Two read from the running
> process".

_[Scroll to the second table and let it sit.]_

Then the half that matters. Business associate agreements, risk analysis, FDA
clearance: all not met, none fixable in software. And our own reading is that
this is probably a regulated device. We fail Criterion 1 of the decision-
support exemption, because analysing a pattern from a signal acquisition
system is what we do.

_[Back to the ward list. Hold.]_

Relay never diagnoses, never scores risk, never escalates by itself. Every
generated sentence passes a guard that blocks clinical claims. A clinician
decides.

---

## Before you start

**Check three numbers on screen.** They are worked out from the clock.

1. The four ward counts. They were **2, 12, 12 and 2**.
2. Maya's persistence. It was **thirty-five hours**.
3. The model score, **above** its nought-point-five line. If it is below that
   day: _"it scored below its own line, so the model stayed quiet, and it still
   shows you every gate it checked."_

**Never say** that the labelled fallback was a Render Workflow run, or that a
reading is irrelevant to a condition. Neither is true.

## If a judge asks

| Question                             | Answer                                                                                                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where did the data come from?        | LifeSnaps, a public research cohort: 71 subjects, 4,453 subject-days, for calibration. One team member's own Apple Health export for engineering validation. 28 synthetic patients in the demo. No patient data, ever |
| How do you know the thresholds work? | 3.35% of subject-days fire on a whole-series baseline, **6.04%** on the trailing baseline a deployment actually has. We quote the second and volunteer the first                                                      |
| Sensitivity?                         | **Unmeasured.** Nobody in the reference cohort deteriorated, so there is no positive class. We say so rather than estimate it                                                                                         |
| What was the model trained on?       | Synthetic only, labelled as such in the artefact's own metadata. Forty synthetic patients per pathway, split 24/8/8                                                                                                   |
| Oncology?                            | Post-chemotherapy is a pathway, neutropenic-fever watch, two patients discharged from Moffitt                                                                                                                         |
| Testing?                             | 90 JavaScript tests, 63 Python, plus integration suites. One runs the Python language guard and its Node port over the same corpus and fails if they disagree phrase for phrase                                       |
| Who signed off the thresholds?       | Nobody. The file says so in capitals: illustrative, not clinically validated. A clinician owns that table before real use                                                                                             |
