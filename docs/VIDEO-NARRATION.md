# Read this out loud

Lines in _[square brackets]_ are for whoever drives the app. Do not read them.

**544 words, about 3 minutes 25.** Devpost caps at three minutes, so two
sentences are marked **(cut)**. Drop both and you are at 3:00 with every topic
still in. Decide before you record.

Everything that does not fit is in `docs/DEVPOST.md`, which the judges read.

---

## The problem · 0:00–0:20

_[Landing page. Slow scroll. Do not click during this section.]_

In healthcare, the hardest person to watch is the one who has gone home. The
thirty days after a discharge are when a patient is most likely to come back,
and when the line to their care team goes quiet. They do not know what is
worth a phone call, and the clinician has forty of them.

> **(cut)** the last clause, "and the clinician has forty of them".

---

## What it does with the data · 0:20–0:55

_[Click "I have a discharge code". Bayfront Health, BAY-2741. Point at the four
readings.]_

Relay turns that stream into something a clinician can act on. Every signal is
cut into six-hour windows and compared with that patient's own median and
median absolute deviation, so the threshold is theirs, not a population's. For
pneumonia, three of four signals must stay past threshold for twenty-four
hours before Relay says anything.

_[Check-in tab. Start the voice check-in, answer one question, point at the
draft it writes.]_

And then it does what most monitoring gets wrong. It does not alarm. It asks.
This is an ElevenLabs conversational agent, and the questions come from the
discharge plan: pneumonia asks about breathing and fever, sleep apnoea about
nights without the CPAP machine. Nothing reaches the care team until the
patient approves it.

---

## Why a hospital cares · 0:55–1:20

_[Clinician tab. Ward list. Point at each of the four state cards.]_

That is the point for a hospital. Twenty-eight patients, and today two need a
clinician. Not twenty-eight charts, two. And Medicare penalises six conditions
on a thirty-day readmission window; four are already pathways here.

_[Open Maya Okafor. Down the left summary, her own words, then "Listen to
summary".]_

Open one and you get the story, not a chart. Four signals past threshold
together for thirty-five hours, her own words beside the numbers, and a FHIR
bundle for the record. There is a spoken version too, our second use of
ElevenLabs, for a clinician between rooms.

---

## The model, and why it stayed quiet · 1:20–2:05

_[Model view. Stop on the score.]_

A second model runs beside that rule: an Isolation Forest, unsupervised,
because nobody in our reference data deteriorated, so there was never a
positive class. It learns this patient's own six-hour windows, and its
threshold is the ninety-fifth percentile of their own validation split.

_[Scroll slowly through "why it stayed quiet" so all four gates are readable.
Hold this shot longest in the video.]_

And look what it did. It scored above its own line, so the model alone would
have spoken. It stayed quiet because the coordination gate failed. Four gates,
each with what was required and what was observed. A product that tells a
clinician why it said nothing is doing the harder half.

_[Render dashboard tab, most recent run. Point at the execution ID as you say
the word.]_

Render Workflow orchestrates the analysis: it runs the machine learning model
and our evidence checks, then returns traceable results that help focus the
patient's check-in and inform the clinician's review. Every run carries an
execution ID.

---

## Where the data goes · 2:05–2:50

_[Patient side, "Your data", the Health import panel.]_

Where does the data go? That Apple Health import is 284 megabytes, parsed
entirely in the browser. Nothing uploaded, no third-party model sees it, and
our content security policy names no third-party script origin at all. Staff
reaching for tools without knowing where data goes is the top named risk in
this field.

> **(cut)** the last sentence, about staff reaching for tools.

_[Clinician side. Security in the sidebar. Point at the green "Live:" lines,
then at a row of the audit trail.]_

Every technical safeguard in the HIPAA Security Rule, cite by cite. Nine
built, one partial. Encrypted at rest, every audit entry carrying the digest
of the one before it, and every access naming a person, not a role.

_[Scroll to the second table and let it sit.]_

Then the half that matters. Business associate agreements, risk analysis, FDA
clearance: all not met, none fixable in software. And our own reading is that
this is probably a regulated device. We fail Criterion 1 of the decision-
support exemption, because analysing a pattern from a signal acquisition
system is what we do.

_[Back to the ward list. Hold.]_

Calibrated on seventy-one real wearable subjects. Ninety JavaScript tests,
sixty-three Python. Relay never diagnoses, never scores risk, never escalates
by itself. A clinician decides.

---

## Before you start

Three numbers are worked out from the clock, so check them on screen.

1. Ward counts, last seen **2, 12, 12 and 2**.
2. Maya's persistence, last seen **thirty-five hours**.
3. The model score, **above** its nought-point-five line. If it is below that
   day: _"it scored below its own line, so the model stayed quiet, and it still
   shows you every gate it checked."_

**Never say** the labelled fallback was a Render Workflow run, or that a reading
is irrelevant to a condition.
