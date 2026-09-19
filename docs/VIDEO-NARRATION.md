# Read this out loud

Lines in _[square brackets]_ are for whoever drives the app. Do not read them.
**574 words, about 3:35.**

---

_[Landing page. Slow scroll. Do not click.]_

In healthcare, the hardest person to watch is the one who has gone home. The
thirty days after a discharge are when a patient is most likely to come back,
and when the line to their care team goes quiet. They do not know what is
worth a phone call.

_[Switch to the iPhone. Tap "Start with your discharge code", then "Look
around as a demo patient". Two taps, no typing. You land on Maya's home.]_

Relay turns that stream into something you can act on. Every signal is cut
into six-hour windows and compared with that patient's own median and median
absolute deviation, so the threshold is theirs, not a population's. Three of
four signals must stay past it for twenty-four hours before Relay says
anything.

_[On the phone, scroll to the "What you can do today" card. Let the list read.
Scroll slowly, it is the best-looking screen in the product.]_

And the patient is not left holding a number. They get a list of things they
can actually do today, written from their own readings and their own discharge
plan: rest more than usual, sit upright rather than lying flat, take the
medicines they were prescribed and nothing extra, add a temperature reading. A
hundred and seventy-three of these sentences across the whole ward, and not
one says what is wrong, because every one passes the same clinical guard.

_[On the phone, tap Check-in in the tab bar. Start the voice check-in, answer
one question, then show the draft it writes.]_

The check-in is an ElevenLabs conversational agent, and the questions come
from the discharge plan: pneumonia asks about breathing and fever, sleep
apnoea about nights without the CPAP machine. Nothing reaches the care team
until the patient approves it.

_[Cut to the laptop. Clinician workspace, ward list. Point at the four state
cards.]_

On the other side, twenty-eight patients, and today two need a clinician. Not
twenty-eight charts, two. Medicare penalises six conditions on a thirty-day
readmission window; four are pathways here.

_[Open Maya Okafor. Left summary, her own words, then "Listen to summary".]_

Open one and you get the story, not a chart, with her own words beside the
numbers. There is a spoken version too, our
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

## The phone

It is the web app in mobile Safari on an iPhone simulator, and it looks like an
app because the layout is built for a phone. **Do not call it a native app.**
If anyone asks, it is a responsive web application and there is no App Store
build.

The patient login is two taps and no typing: **Start with your discharge code**,
then **Look around as a demo patient**. That issues a demo identity to that
browser and hands it one synthetic record, Maya Okafor, discharge code
BAY-2741. Signing in with an email and password instead needs an account, and
creating one needs the patient access code from the Render dashboard.

Wake the site on the phone before you record. The free instance sleeps, and the
first load after that is slow.

## Say these accurately

- **A disk, not a database.** A Render persistent disk holding encrypted JSON.
  No database is declared in the blueprint.
- The safeguard table now reads **eleven built, one partial**. All ten technical
  safeguards are built; the partial is minimum necessary.
- The standalone "what software cannot fix" table was removed. That content now
  lives in **Before clinical use** at the bottom of the same page.
- Never call the labelled fallback a Render Workflow run, and never say a
  reading is irrelevant to a condition.
