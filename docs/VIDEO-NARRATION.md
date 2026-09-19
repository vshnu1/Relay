# Read this out loud

The lines in _[square brackets]_ are for whoever is driving the app. Do not
read them. Everything else is yours, top to bottom.

About 500 words, so roughly three minutes at a normal pace. Pause a beat at
each paragraph break; that is where your teammate catches up.

---

## Set the problem first · about 0:00–0:40

_[Landing page. Slow scroll through the top. Do not click during this whole
section.]_

In healthcare, the hardest person to watch is the one who has gone home. The
thirty days after a discharge are when a patient is most likely to end up back
in hospital, and they are also when the line to their care team goes quiet.

The patient does not know which change is worth a phone call. The clinician
has forty patients and cannot watch any of them continuously. And the watch on
that wrist records the whole time, unread, because one reading alone tells you
nothing.

Relay is what those thirty days look like instead. It watches each patient's
readings against their own baseline, and when several move together and stay
moved, it asks the patient what was going on. Then it hands the care team the
pattern, with the patient's own words beside it.

---

## The patient · about 0:40–1:10

_[Click "I have a discharge code". Bayfront Health, code BAY-2741, continue.
Land on the patient home and point at the four readings.]_

The patient signs in with the code from their discharge letter. No new
hardware: it reads the watch they already own, and compares every reading with
their own usual, never a population range.

_[Check-in tab. Start the voice check-in, answer one question, then point at
the draft it writes.]_

And here is where most monitoring gets it wrong. When readings move, Relay
does not raise an alarm. It asks. This is an ElevenLabs agent, and the
questions come from the discharge plan itself, so pneumonia asks about
breathing and fever. Nothing reaches the care team until the patient approves
it.

---

## The clinician · about 1:10–1:35

_[Clinician tab. Ward list. Point at each of the four state cards.]_

The care team sees one screen. Twenty-eight patients in four states: two need
review, twelve waiting on a check-in, two without enough data. Most tools
cannot tell a quiet patient from one nobody can see.

_[Open Maya Okafor. Down the left-hand summary, then to her own words.]_

Open one and you get the story, not a chart. Settled by day three, drifting on
day seven, four signals past threshold together for thirty-five hours, and her
own words beside the numbers.

---

## The model, and why it stayed quiet · about 1:35–2:15

_[Model view. Stop on the score.]_

A second model runs beside that rule: an Isolation Forest, unsupervised,
because nobody in our reference data deteriorated, so there was never a
positive class to train on. It learns this patient's own six-hour windows,
then scores how far today's sits from them.

_[Scroll slowly through "why it stayed quiet" so all four gates are readable.
Hold this shot the longest of any in the video.]_

Now look what it did. It scored above its own line, so the model alone would
have spoken. It stayed quiet because the coordination gate failed, and it
shows you that rather than hiding it. A product that tells a clinician why it
said nothing is doing the harder half.

_[Render dashboard tab, most recent run. Point at the execution ID.]_

All of it runs as a Render Workflow, and every run has an execution ID, so any
number on that screen traces back to the run that produced it.

---

## How the data is handled · about 2:15–2:50

_[Back to the app. Security in the sidebar. Point at the two green "Live:"
lines.]_

This is the part most demos skip. Every technical safeguard in the HIPAA
Security Rule, cite by cite. Nine built, one partial, and two of them read
from the running process rather than asserted.

_[Scroll to the second table and let it sit on screen.]_

Then the half that matters. Business associate agreements. Risk analysis. FDA
clearance. All not met, none of them fixable in software. We would rather show
you the gaps than have you find them.

_[Back to the ward list. Hold.]_

Relay never diagnoses, never scores risk, never escalates by itself. Every
generated sentence passes a guard that blocks clinical claims. A clinician
decides.

---

## Before you start

**Check three numbers on screen.** They are worked out from the clock, so they
move.

1. The four ward counts. They were **2, 12, 12 and 2**.
2. Maya's persistence. It was **thirty-five hours**.
3. The model score, **above** its nought-point-five line. If it is below on the
   day, say instead: _"it scored below its own line, so the model stayed quiet,
   and it still shows you every gate it checked."_

**If you need to lose fifteen seconds**, drop the second paragraph of the
opening, the one beginning "The patient does not know". The first and third
still set the problem and say what Relay is.

**Never say** that the labelled fallback was a Render Workflow run, or that a
reading is irrelevant to a condition. Neither is true.
