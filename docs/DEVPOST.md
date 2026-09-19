# Devpost submission copy

Paste-ready. Everything here is checkable against the repository, and the last
section says where each number comes from.

---

## Elevator pitch (one line)

Relay watches the thirty days after a hospital discharge, compares each
patient's wearable readings with their own baseline rather than a population
range, asks them what was happening when several move together, and hands the
care team one reviewable evidence packet.

---

## Inspiration

The thirty days after a discharge are when a patient is most likely to be
readmitted, and they are also when the line to the care team goes quiet. The
patient does not know which change is worth a phone call. The clinician has
forty patients and cannot watch any of them continuously. Meanwhile the watch
on that patient's wrist has been recording the whole time, and nobody reads it,
because a single reading out of context means nothing.

Medicare penalises six conditions on a thirty-day readmission window. Four of
them — heart failure, pneumonia, COPD, and hip and knee replacement — are
already recovery pathways in Relay.

---

## What it does

**Turns a continuous stream into an evidence packet.**

1. **Collects.** Reads what the patient's existing wearable already records, plus
   an Apple Health export that is inflated and parsed entirely in the browser.
   No new hardware.
2. **Normalises.** Cuts every signal into six-hour windows across a thirty-day
   monitoring window.
3. **Compares to the person, not the population.** Each window is measured
   against that patient's own median and median absolute deviation. We measured
   why this matters: across the 66 subjects with usable baselines, resting heart
   rate spans 31 beats between people while one person varies about 2.4 day to
   day. A single population threshold cannot serve both.
4. **Requires coordination and persistence.** For pneumonia, three of four
   counted signals must each stay past threshold for 24 hours with 24 hours of
   overlap. One odd reading does nothing.
5. **Asks, rather than alarms.** When that happens, an ElevenLabs conversational
   agent runs a check-in whose questions come from the discharge plan itself.
   Nothing reaches the care team until the patient reviews and approves it.
6. **Tells the patient what to do.** A "What you can do today" card turns the
   same readings into a list of safe, concrete actions drawn from their own
   discharge plan: rest more than usual, sit upright rather than lying flat,
   take the prescribed medicines and nothing extra, add a temperature reading.
   Across all 28 demo patients that is 173 distinct sentences, and every one
   passes the clinical language guard. None of them names a condition, grades a
   reading, or promises an outcome.
7. **Hands over one packet.** The clinician gets the pattern, the patient's own
   words, a cohort comparison, a mock FHIR bundle, and the follow-up options.

**Each recovery pathway watches different signals.** Fifteen pathways. Sleep is
counted for a COPD flare-up and watched for context in pneumonia. Weight counts
for heart failure. The app says which, on screen, for every reading.

**It says when it cannot see.** Four states: review recommended, context needed,
monitoring, and not enough data. Most tools cannot distinguish a quiet patient
from one nobody can see.

---

## How we built it

**Stack.** React and Vite on the front end, Express on the API, a Python
analysis package, all deployed on Render.

**Render Workflows.** Render Workflow orchestrates the analysis: it runs the
machine learning model and our evidence checks, then returns traceable results
that help focus the patient's check-in and inform the clinician's review. The
pipeline is six tasks — ingest and normalise, calculate baseline, detect
coordinated deviation, request context, score with the Python model, compile
the review item. It runs when a patient starts a check-in, when their answers
are submitted, and when a clinician analyses or simulates a case. It does not
run per wearable reading or per voice turn, so the live conversation stays fast.
Every run returns an execution ID, and any number on the clinician's screen
traces back to the run that produced it. If the Workflow is unavailable the app
uses a clearly labelled fallback, and the interface never calls that a Workflow
run.

**The machine learning model.** An Isolation Forest, 200 trees, unsupervised.
Unsupervised is not a shortcut: nobody in our reference cohort deteriorated, so
there was never a positive class to train a classifier on, and we say so rather
than inventing labels. Per six-hour window it builds eleven features — the
robust deviation of each metric from that patient's own median, plus coverage,
count of fresh signals, count of deviating core signals, and mean absolute
deviation across core signals. It fits to that patient's own history with a
chronological train/validation/test split, never a random one, so it cannot
peek at the future. The threshold is the 95th percentile of that patient's own
validation scores, and scores are mapped through a logistic centred on it, so
0.5 means exactly at the line. Where a patient has too little history it falls
back to a per-pathway prior trained on 40 synthetic patients, labelled synthetic
in the artefact's own metadata. Isolation Forest gives no feature importance, so
explanations come from the robust deviations themselves rather than from the
model.

**The restraint ledger.** The model's verdict passes four gates: signals moving
together, persistence across windows, the anomaly score, and data quality. Each
is displayed with what was required and what was observed. The clinician can see
why Relay stayed quiet as easily as why it spoke.

**ElevenLabs, in two places.** A conversational agent runs the patient's
check-in, with one client tool that drafts structured answers the patient then
corrects and approves. And a spoken clinician briefing, text to speech, for a
clinician between rooms.

**The clinical boundary, enforced at runtime.** Relay never diagnoses, predicts
risk, grades severity, recommends treatment, or escalates by itself. Every
generated sentence passes a language guard against five rule families before it
leaves the server. A sentence that trips one is replaced with a description of
the readings and the redaction is recorded and shown. The guard exists twice,
in Python and in Node, and a test fails if the two disagree phrase for phrase,
because a boundary enforced in one language and not the other is not enforced.

**Security and HIPAA.** There is a Security page in the product rendering all
ten technical safeguards of the HIPAA Security Rule, 45 CFR 164.312, cite by
cite. Nine built, one partial. Named accounts with scrypt-hashed passwords and
revocable server-side sessions. AES-256-GCM over state, the account store and
every audit line. The audit log is a hash chain, so an edited or removed entry
breaks every digest after it and the verifier names the line. Every access
records the acting person, carried through the model's asynchronous work by an
AsyncLocalStorage so one request cannot be attributed to another. A content
security policy with no third-party script origin at all, and self-hosted
typefaces, so not even a font request tells anyone who opened a record.

---

## Challenges

**Calibrating honestly.** Our false-alarm rate is 3.35% of subject-days when the
baseline is built from a subject's whole series — which includes the day being
judged. Measured the way a deployment actually works, judging each day only
against the days before it, it is **6.04%**. We report both, separately, because
quoting the first as the second overstates the product by nearly half.

**Sensitivity is unmeasured, and we say so.** Nobody in the reference cohort
deteriorated after a discharge, so there is no positive class to count. How
often Relay stays quiet when it should speak is unknown, and no clinical
validation study exists.

**Regulatory status.** On our own reading, Relay is probably device software. The
Clinical Decision Support exemption in FD&C Act 520(o)(1)(E) requires all four
criteria, and we fail the first: it excludes software that analyses a pattern
from a signal acquisition system, which is exactly what reading a wearable
stream and requiring 24 hours of persistence is. We concede it in writing rather
than claim an exemption that does not survive the first question.

---

## Accomplishments

- A compliance page inside the product, not a markdown file, with the unmet rows
  on it.
- A model that shows why it stayed quiet, gate by gate.
- A measured, published difference between an in-sample and a deployed false
  alarm rate.
- 90 JavaScript tests, 63 Python tests, and two HTTP integration suites, one of
  which exercises the exact configuration the deployment runs.

---

## What we learned

That the hardest part of a clinical product is not detection, it is restraint,
and that a system which cannot say "I do not have enough data" will eventually
tell somebody they are fine when nobody was looking.

---

## What's next

Care-team scoping, which would make break-glass emergency access mean something
rather than record a declaration. A patient data export and a deletion endpoint,
for right of access and Washington's My Health My Data Act. FHIR conformance:
LOINC codes, UCUM units, and a Device or Provenance resource saying these
readings are wearable-derived. Billing-readiness counters for the CMS remote
monitoring codes. And a clinician to own the threshold table, which the code
says in capitals is illustrative and not clinically validated.

---

## Where every number comes from

| Claim                                                                 | Source                                                                                                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 31 beats between-person spread, 2.4 within-person                     | `fixtures/calibration.json`, 66 subjects with usable baselines                                                                                  |
| 3.35% and 6.04% false alarms                                          | `fixtures/calibration.json`, 4,420 subject-days                                                                                                 |
| Detection lag: next day at 2 personal sd, against five days for noise | `fixtures/sensitivity.json`                                                                                                                     |
| Reference cohort                                                      | LifeSnaps, public research data: 71 subjects, 4,453 subject-days                                                                                |
| Engineering validation                                                | One team member's own Apple Health export, 284 MB, de-identified under a secret not in the repository                                           |
| Demo patients                                                         | 28 synthetic, 15 pathways, 13 hospital units. No patient data, ever                                                                             |
| Model priors                                                          | Synthetic only, 40 synthetic patients per pathway, split 24/8/8, labelled in the artefact metadata                                              |
| Tests                                                                 | `npm test`, `PYTHONPATH=ml python3 -m unittest discover -s ml/tests`, `node tests/api.integration.js`, `node tests/accountsMode.integration.js` |
| Thresholds                                                            | `src/recovery/model/profiles.js`, which states in capitals that they are illustrative and not clinically validated                              |
