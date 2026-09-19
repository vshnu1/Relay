# Read this out loud

Lines in _[square brackets]_ are for whoever drives the app. Do not read them.

**586 words, about 3 minutes 40.** Devpost caps at three minutes. Four sentences
are marked **(cut)**; drop all four and you are at roughly 3:00 with every topic
still present. Decide before you record.

What does not fit is in `docs/DEVPOST.md`, which judges read.

---

## The problem · 0:00–0:20

_[Landing page. Slow scroll. Do not click.]_

In healthcare, the hardest person to watch is the one who has gone home. The
thirty days after a discharge are when a patient is most likely to come back,
and when the line to their care team goes quiet. They do not know what is
worth a phone call, and the clinician has forty of them.

> **(cut)** "and the clinician has forty of them".

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
draft.]_

And then it does what most monitoring gets wrong. It does not alarm. It asks.
This is an ElevenLabs conversational agent, and the questions come from the
discharge plan: pneumonia asks about breathing and fever, sleep apnoea about
nights without the CPAP machine. Nothing reaches the care team until the
patient approves it.

---

## Why a hospital cares · 0:55–1:20

_[Clinician tab. Ward list. Point at the four state cards.]_

That is the point for a hospital. Twenty-eight patients, and today two need a
clinician. Not twenty-eight charts, two. And Medicare penalises six conditions
on a thirty-day readmission window; four are already pathways here.

> **(cut)** the Medicare sentence. It is in the Devpost text.

_[Open Maya Okafor. Left summary, her own words, then "Listen to summary".]_

Open one and you get the story, not a chart. Four signals past threshold
together for thirty-five hours, her own words beside the numbers, and a FHIR
bundle for the record. There is a spoken version too, our second use of
ElevenLabs.

---

## The model, and why it stayed quiet · 1:20–2:00

_[Model view. Stop on the score.]_

A second model runs beside that rule: an Isolation Forest, unsupervised,
because nobody in our reference data deteriorated, so there was never a
positive class. It learns this patient's own six-hour windows, and its
threshold is the ninety-fifth percentile of their own validation split.

_[Scroll slowly through "why it stayed quiet" so all four gates are readable.
Hold this shot longest.]_

And look what it did. It scored above its own line, so the model alone would
have spoken. It stayed quiet because the coordination gate failed. Four gates,
each with what was required and what was observed. A product that tells a
clinician why it said nothing is doing the harder half.

_[Render dashboard tab, latest run. Point at the execution ID as you say it.]_

Render Workflow orchestrates the analysis: it runs the machine learning model
and our evidence checks, then returns traceable results that help focus the
patient's check-in and inform the clinician's review. Every run carries an
execution ID.

---

## Storage, transmission, protection · 2:00–2:35

_[Security page. Point at the safeguard table, then at the two green "Live:"
lines as you name encryption.]_

So where does patient data live, and how is it protected? That Apple Health
import is parsed entirely in the browser and never uploaded. What the server
does hold sits on an encrypted disk on Render: the record, the accounts and
the audit log, all AES-256-GCM at rest. In transit, TLS with strict transport
security, and a content security policy that names no third-party script
origin at all. Accounts are named, passwords scrypt-hashed, sessions
revocable, and a patient is scoped on the server to their one record.

> **(cut)** "Accounts are named, passwords scrypt-hashed, sessions revocable,
> and". Keep "a patient is scoped on the server to their one record."

---

## The audit trail · 2:35–3:00

_[Scroll to the audit trail. Point at one row, then at the actor name on it.
Let it sit for three seconds, then move on.]_

And this is audit controls, 164.312(b). Every access records the person who
made it, not just their role, carried through the model's asynchronous work so
one request can never be attributed to another. Each entry carries the digest
of the one before it, so an edited or deleted line breaks the chain and the
page names where. That is what makes it evidence rather than a list.

> **(cut)** "carried through the model's asynchronous work so one request can
> never be attributed to another".

_[Scroll to the second table. Two seconds, no more.]_

What is not met is on the same page. Business associate agreements, risk
analysis, FDA clearance: none of them fixable in software.

_[Back to the ward list. Hold.]_

Our own reading is that this is probably a regulated device, and we say so
rather than claim an exemption. Ninety JavaScript tests, sixty-three Python.
Relay never diagnoses, never scores risk, never escalates by itself. A
clinician decides.

---

## Before you start

Three numbers come from the clock. Check them on screen.

1. Ward counts, last seen **2, 12, 12 and 2**.
2. Maya's persistence, last seen **thirty-five hours**.
3. The model score, **above** its nought-point-five line. If below that day:
   _"it scored below its own line, so the model stayed quiet, and it still
   shows you every gate it checked."_

## Two things to say accurately

**It is a disk, not a database.** Patient data sits on a Render persistent
disk, encrypted at rest with AES-256-GCM. There is no database in the
blueprint. "Encrypted disk on Render" is true and names the mechanism, which is
stronger for a security reviewer than "secured database" anyway.

**Never** call the labelled fallback a Render Workflow run, and never say a
reading is irrelevant to a condition.

## If Pranav's patient next-steps ship in time

Nothing for it is in the app yet. If it lands, add one sentence after the
check-in beat and cut the Medicare sentence to pay for it:

> "And the patient is not left holding a number. They get the next step their
> discharge plan calls for."
