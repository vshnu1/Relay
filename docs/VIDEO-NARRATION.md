# Read this out loud

Lines in _[square brackets]_ are for whoever drives the app. Do not read them.
**564 words, about 3:31.**

---

_[Landing page. Slow scroll. Do not click.]_

In healthcare, the hardest person to watch is the one who has gone home. The
thirty days after a discharge are when a patient is most likely to come back,
and when the line to their care team goes quiet. They do not know what is
worth a phone call, and the clinician has forty of them.

_[Click "I have a discharge code". Bayfront Health, BAY-2741. Patient home.]_

Relay turns that stream into something you can act on. Every signal is cut
into six-hour windows and compared with that patient's own median and median
absolute deviation, so the threshold is theirs, not a population's. Three of
four signals must stay past it for twenty-four hours before Relay says
anything.

_[Point at the guidance card, the one with the next step and the Check in
button.]_

And the patient is not left holding a number. They get one next step, written
from their own readings: breathing faster than usual since day nine, three
others moved with it for thirty-five hours, so complete your check-in and
meanwhile follow your discharge letter. It names the devices it used, and
never says what is wrong.

_[Click Check in. Start the voice check-in, answer one question, point at the
draft it writes.]_

The check-in is an ElevenLabs conversational agent, and the questions come
from the discharge plan: pneumonia asks about breathing and fever, sleep
apnoea about nights without the CPAP machine. Nothing reaches the care team
until the patient approves it.

_[Clinician tab. Ward list. Point at the four state cards.]_

On the other side, twenty-eight patients, and today two need a clinician. Not
twenty-eight charts, two. Medicare penalises six conditions on a thirty-day
readmission window; four are pathways here.

_[Open Maya Okafor. Left summary, her own words, then "Listen to summary".]_

Open one and you get the story, not a chart, with her own words beside the
numbers and a FHIR bundle for the record. There is a spoken version too, our
second use of ElevenLabs.

_[Model view. Stop on the score.]_

A second model runs beside that rule: an Isolation Forest, unsupervised,
because nobody in our reference data deteriorated, so there was never a
positive class. It learns this patient's own windows, and its threshold is the
ninety-fifth percentile of their own validation split.

_[Scroll slowly through "why it stayed quiet" so all four gates read. Hold
longest.]_

And look what it did. It scored above its own line, so the model alone would
have spoken. It stayed quiet because the coordination gate failed. Four gates,
each with what was required and what was observed. A product that tells you
why it said nothing is doing the harder half.

_[Render dashboard tab, latest run. Point at the execution ID as you say it.]_

Render Workflow orchestrates the analysis: it runs the machine learning model
and our evidence checks, then returns traceable results that help focus the
patient's check-in and inform the clinician's review. Every run carries an
execution ID.

_[Security page. Point at the safeguard table, then the green "Live:" lines.]_

So where does patient data live? The Apple Health import is parsed in the
browser and never uploaded. What the server holds sits on an encrypted disk on
Render, AES-256-GCM at rest. In transit, TLS, strict transport security, and a
policy naming no third-party script origin at all.

_[Scroll to the audit trail. Point at one row, then at the person's name on it.
Three seconds, then move on.]_

And this is audit controls, 164.312(b). Every access records the person who
made it, not just their role. Each entry carries the digest of the one before
it, so an edited line breaks the chain and the page names where. That makes it
evidence, not a list.

_[Scroll to "Before clinical use". Two seconds.]_

All ten technical safeguards built, plus a patient's right to take a copy of
their record. What is left sits under Before clinical use: a business
associate agreement, a risk analysis, workforce training, clinical evaluation.
None fixable in software.

_[Back to the ward list. Hold.]_

And our own reading is that this is probably a regulated device, which we say
rather than claim an exemption. Relay never diagnoses, never scores risk,
never escalates by itself. A clinician decides.

---

## Before you record

Three numbers come from the clock. Check them on screen.

1. Ward counts, last seen **2, 12, 12 and 2**.
2. Maya's persistence, last seen **thirty-five hours**.
3. The model score, **above** its nought-point-five line. If below that day:
   _"it scored below its own line, so the model stayed quiet, and it still shows
   you every gate it checked."_

## Say these accurately

- **A disk, not a database.** A Render persistent disk holding encrypted JSON.
  No database is declared in the blueprint.
- The safeguard table now reads **eleven built, one partial**. All ten technical
  safeguards are built; the partial is minimum necessary.
- The standalone "what software cannot fix" table was removed. That content now
  lives in **Before clinical use** at the bottom of the same page.
- Never call the labelled fallback a Render Workflow run, and never say a
  reading is irrelevant to a condition.
