# Demo video script — 490 words, about 2:58 spoken

Written against the deployed site. Every number traces to a fixture or to the
code, and the table at the end says which. Do not add a statistic you cannot
source on the spot, however good it sounds: a judge who checks one and finds it
borrowed will discount the rest, and the rest is the strong part.

## The one idea

Most remote monitoring does one of two things. It alarms, and the clinician
drowns. Or it scores, and nobody can see why. **Relay asks the patient, and it
shows its working, including when it decided to stay quiet.** Everything in the
video should ladder back to that.

## Before you press record

- [ ] **Do not push to `main` in the half hour before.** Every push redeploys,
      and the site answers 502 for a minute or two.
- [ ] Open <https://relay-bayhacks.onrender.com> once to wake the free instance,
      then hard refresh.
- [ ] Sign out, so you start on the public landing page.
- [ ] **Tab 2:** patient app, already signed in as Maya, sitting on the
      check-in screen. Recording a sign-in is dead air.
- [ ] **Tab 3:** Render dashboard, Workflows, runs list, most recent run open.
- [ ] Open Maya's clinician page once so the model has already scored. It takes
      several seconds on a cold instance and you do not want that on camera.
- [ ] Zoom the browser to 110–125%. Text that is legible on your monitor is not
      legible in a 1080p upload.
- [ ] **Check three numbers on screen before you say them,** because they are
      derived from the clock: the four ward counts, Maya's persistence hours,
      and the model score. They were 2 / 12 / 12 / 2, thirty-five hours and
      0.74 when this was written.

---

**If you need to lose fifteen seconds**, cut the opening narration and let the
landing page speak for itself for four seconds, then come in at "Relay is those
thirty days." The gap beat is the only one whose visual carries the point
without words. Do not cut the gate ledger or the second safeguards table; they
are the two things nobody else will have.

---

## 0:00–0:16 · The gap

**Screen:** public landing page, slow scroll through the hero. Do not click.

> "The thirty days after a discharge are the riskiest, and the days nobody is
> watching. The wearable on the patient's wrist records through all of them,
> and nobody reads it, because no clinician can watch forty patients at once."

---

## 0:16–0:36 · The patient, and their own baseline

**Screen:** click **I have a discharge code** → **Bayfront Health** → type
**BAY-2741** → continue. Land on the patient home. Point at the alert card,
then run the cursor down the four readings.

> "Relay is those thirty days. The patient signs in with the code from their
> discharge letter, and it reads the watch they already own. Every reading is
> compared with that person's own usual, never a population range. Maya's four
> have moved together, and stayed moved."

---

## 0:36–1:04 · It asks, rather than alarms

**Screen:** switch to **Tab 2**, already on the check-in. Click **Voice
conversation**, answer the first question aloud. Then point at the draft it
writes.

> "This is where most monitoring gets it wrong. When readings move, Relay does
> not alarm. It asks. That is an ElevenLabs agent, and the questions come from
> the discharge plan: pneumonia asks about breathing and fever, sleep apnoea
> about nights without the CPAP machine. Nothing reaches the care team until
> the patient approves it."

_Microphone risk? Use **Text conversation**. Same agent contract, always works._

---

## 1:04–1:32 · What the clinician gets

**Screen:** Tab 1 → `/#/login` → **Look around as a demo clinician**. On the
ward list, point at each of the four state cards in turn.

> "The care team sees one screen. Twenty-eight patients in four states. Two need
> review, twelve waiting on a check-in, two without enough data. Most tools
> cannot tell a quiet patient from one nobody can see."

**Screen:** open **Maya Okafor**. Read down the left, then scroll to the
readings table and stop on the patient's own words.

> "Open one and you get the story, not a chart. Settled by day three, drifting
> on day seven, all four signals past threshold together for thirty-five hours,
> no workout to explain it, and her own words beside the numbers."

---

## 1:32–2:12 · The centrepiece: how the model works, and why it stayed quiet

**Screen:** scroll to **Model view**. Stop on the score.

> "A second model runs beside the rule. It is an Isolation Forest, and it is
> unsupervised, because nobody in our reference data deteriorated, so there was
> never a positive class to train on. It learns what this patient's own
> six-hour windows normally look like, then scores how easily today's window
> can be isolated from them. The threshold comes from that patient's own
> validation split, so 0.5 means exactly at the line."

**Screen:** point at the score, then scroll slowly through **why it stayed
quiet** so all four gates are readable. Hold this shot longest.

> "Look what it did here. It scored above its own line, so the model alone would
> have spoken. It did not, because the coordination gate failed, and the system
> shows you that rather than hiding it. Four gates, each with what was required
> and what was observed. A product that tells a clinician why it said nothing
> is doing the harder half."

_Read the score off the screen before you narrate it. If it is below 0.50 that
day, say: "it scored below its own line, so the model stayed quiet, and it
shows you the gates it checked to get there." The point survives either way,
and the point is that the reasoning is visible._

**Screen:** switch to **Tab 3**, the Render run. Point at the execution ID.

> "All of it runs as a Render Workflow: normalise, baseline, check for
> coordinated change, compile the evidence. Every run has an execution ID, so
> any number on that screen traces back to the run that produced it."

---

## 2:12–2:38 · How the data is handled

**Screen:** back to Tab 1, click **Security** in the sidebar.

> "The part most demos skip. Every technical safeguard in the HIPAA Security
> Rule, cite by cite. Nine built, one partial."

**Screen:** point at the two green **Live:** lines, then scroll to the second
table and let it sit.

> "Two are read from the running process, not asserted: whether the data is
> encrypted, and whether the audit log verifies. And here is the half that
> matters. Business associate agreements, risk analysis, FDA clearance. All not
> met, none fixable in software. We would rather show you the gaps than have
> you find them."

---

## 2:38–2:52 · Close

**Screen:** back to the ward list.

> "Relay never diagnoses, never scores risk, never escalates by itself. Every
> sentence it generates passes a runtime guard that blocks clinical claims. It
> surfaces a pattern and the patient's own words, and a clinician decides."

---

## If a judge asks

| Claim                         | Where it comes from                                                                                                                                                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why personal baselines        | Across the 66 subjects with usable baselines, resting heart rate spans 31 beats while one person varies about 2.4 day to day (`fixtures/calibration.json`)                                                                                         |
| False alarms                  | 3.35% of subject-days at the shipped 1.75 sd on a whole-series baseline; **6.04%** on the trailing baseline a deployment actually has. Quote the second and volunteer the first                                                                    |
| Speed                         | A coordinated two-sd change is seen the next day, against five days for the same person's own noise                                                                                                                                                |
| Sensitivity                   | **Unmeasured, and say so.** Nobody in the reference cohort deteriorated, so there is no positive class                                                                                                                                             |
| Where the data came from      | LifeSnaps, a public research cohort: 71 subjects, 4,453 subject-days, for calibration and cohort context. One team member's own Apple Health export for engineering validation. Twenty-eight synthetic patients in the demo. No patient data, ever |
| What the model was trained on | Synthetic only. Each prior carries the label in its own metadata: "contains no real measurements". Forty synthetic patients per pathway, split 24/8/8                                                                                              |
| Tests                         | 84 JavaScript, 63 Python, and integration suites. One runs the Python language guard and its Node port over the same corpus and fails if they disagree phrase for phrase                                                                           |
| Is it a regulated device?     | On our own reading, probably yes, and we concede it in writing. We fail Criterion 1 of the clinical decision support exemption, because analysing a pattern from a signal acquisition system is exactly what we do                                 |
| Who signed off the thresholds | Nobody. `profiles.js` says so in capitals: illustrative, not clinically validated. A clinician has to own that table before real use                                                                                                               |

## Two things never to say

1. Never call the labelled fallback a Render Workflow run. The app
   distinguishes them and so should you.
2. Never say a reading is irrelevant to a condition. No clinician has signed
   that table. Say it is watched for context and does not ask for a review.
