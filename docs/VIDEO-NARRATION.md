# Read this out loud

The lines in _[square brackets and italics]_ are for whoever is driving the
app. Do not read them. Everything else is yours, top to bottom.

Pause for about a second at each paragraph break. That is where your teammate
catches up.

---

_[Landing page. Slow scroll through the top. Do not click yet.]_

The thirty days after a discharge are the riskiest, and the days nobody is
watching. The wearable on the patient's wrist records through all of them. No
one reads it, because no clinician can watch forty patients at once.

_[Click "I have a discharge code". Choose Bayfront Health, enter BAY-2741,
continue. Land on the patient home.]_

Relay is those thirty days. The patient signs in with the code from their
discharge letter, and it reads the watch they already own. Every reading is
compared with that person's own usual, never a population range. Maya's four
have all moved together, and stayed moved.

_[Switch to the check-in tab. Start the voice check-in and answer one question.
Then point at the draft it writes.]_

This is where most monitoring gets it wrong. When readings move, Relay does not
raise an alarm. It asks. That is an ElevenLabs agent, and the questions come
from the discharge plan: pneumonia asks about breathing and fever, sleep apnoea
about nights without the CPAP machine. Nothing reaches the care team until the
patient approves it.

_[Clinician tab. The ward list. Point at each of the four state cards.]_

The care team sees one screen. Twenty-eight patients in four states. Two need
review, twelve waiting on a check-in, two without enough data. Most tools
cannot tell a quiet patient from one nobody can see.

_[Open Maya Okafor. Scroll down the left-hand summary, then to her own words.]_

Open one and you get the story, not a chart. Settled by day three, drifting on
day seven, all four signals past threshold together for thirty-five hours, and
her own words beside the numbers.

_[Scroll to Model view. Stop on the score.]_

A second model runs beside that rule. It is an Isolation Forest, and it is
unsupervised, because nobody in our reference data deteriorated, so there was
never a positive class to train on. It learns what this patient's own six-hour
windows normally look like, then scores how easily today's isolates from them.
The threshold comes from her own validation split, so nought point five means
exactly at the line.

_[Scroll slowly through "why it stayed quiet" so all four gates are readable.
Hold this shot the longest.]_

Now look what it did. It scored above its own line, so the model on its own
would have spoken. It did not, because the coordination gate failed, and the
system shows you that rather than hiding it. Four gates, each with what was
required and what was observed. A product that tells a clinician why it said
nothing is doing the harder half.

_[Switch to the Render dashboard tab, most recent workflow run. Point at the
execution ID.]_

All of it runs as a Render Workflow. Normalise, baseline, check for coordinated
change, compile the evidence. Every run has an execution ID, so any number on
that screen traces back to the run that produced it.

_[Back to the app. Click Security in the sidebar.]_

And this is the part most demos skip. Every technical safeguard in the HIPAA
Security Rule, cite by cite. Nine built, one partial.

_[Point at the two green "Live:" lines, then scroll to the second table and let
it sit on screen.]_

Two of these are read from the running process rather than asserted: whether
the data is encrypted, and whether the audit log still verifies. And here is
the half that matters. Business associate agreements. Risk analysis. FDA
clearance. All not met, none of them fixable in software. We would rather show
you the gaps than have you find them.

_[Back to the ward list. Hold.]_

Relay never diagnoses, never scores risk, never escalates by itself. Every
sentence it generates passes a runtime guard that blocks clinical claims. It
surfaces a pattern and the patient's own words. A clinician decides.

---

## Three things to check on screen before you start

They are worked out from the clock, so they can move.

1. The four ward counts. They were **2, 12, 12 and 2**.
2. Maya's persistence. It was **thirty-five hours**.
3. The model score. It was **above** its nought-point-five line. If it is below
   on the day, say instead: _"it scored below its own line, so the model stayed
   quiet, and it still shows you every gate it checked to get there."_
