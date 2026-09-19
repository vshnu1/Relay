# Demo video script — 452 words, about 2 minutes 45

Written against the deployed site on 19 September. Every number in the
narration is checked against the code or a fixture; the sources are in the last
section so you can defend any of them on the spot.

**Before you record.** Do not push to `main` in the half hour beforehand: every
push redeploys and the site answers 502 for a minute or two. Open
<https://relay-bayhacks.onrender.com> once to wake the free instance, then hard
refresh. Sign out so you start at the public landing page. Have a second tab
already on the Render dashboard, Workflows, runs list.

**Two columns.** _Screen_ is what you do. _Say_ is what you say over it. Say it
in your own words. It is 452 words of narration, about 2:45 at a brisk
demo pace, which leaves room inside the three-minute cap for the clicks.

**Read the screen, not the script, for two numbers.** The ward counts are 2
needing review, 12 waiting on a check-in, 12 monitoring and 2 without enough
data, and Maya's change has persisted 35 hours. Both are derived live from the
clock, so glance at the screen before you say them. The persistence figure can
shift by an hour or two depending on when you record.

**One rule.** Every number in this script traces to a fixture or to the code,
and the table at the end says which. Do not add a statistic you cannot source
on the spot, however good it sounds. A judge who checks one and finds it
borrowed will discount the rest, and the rest is the strong part.

---

## 0:00–0:18 · The problem

| Screen                                                                                   | Say                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The public landing page at the root URL. Slow scroll through the hero. Do not click yet. | "The thirty days after a discharge are the riskiest, and the days nobody is watching. The wearable on the patient's wrist records through all of them. Nobody reads it, because no clinician can watch forty patients at once." |

---

## 0:18–0:40 · What it is, and the patient side

| Screen                                                                                                                                       | Say                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Click **I have a discharge code**. On the patient sign-in choose **Bayfront Health**, type **BAY-2741**, continue. Land on the patient home. | "Relay is those thirty days. The patient signs in with the code on their discharge letter. No new hardware: it reads the watch they own."                                         |
| Point at the alert card, then at the four readings.                                                                                          | "Every reading is compared with that person's own usual, not a population range. Maya's breathing, heart rate, temperature and oxygen have all moved together, and stayed moved." |

---

## 0:40–1:12 · The check-in, and ElevenLabs

| Screen                                                                                                                                                         | Say                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open **Check-in**. Choose **Voice conversation** if your microphone is good, otherwise **Text conversation**. Answer the first question out loud or by typing. | "When readings move, Relay does not raise an alarm. It asks. This is an ElevenLabs conversational agent, and the questions come from the discharge plan: pneumonia asks about breathing and fever, sleep apnoea about nights without the CPAP machine. Fifteen pathways, each with its own list." |
| Let it record your answer, then point at the draft.                                                                                                            | "Nothing is sent until the patient approves it. The agent drafts; the patient decides."                                                                                                                                                                                                           |

_If the microphone is a risk, use the text path. It is the same agent contract
and it always works._

---

## 1:12–1:50 · The clinician side

| Screen                                                                | Say                                                                                                                                                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New tab. Go to `/#/login`, click **Look around as a demo clinician**. | "The care team sees one screen."                                                                                                                                                            |
| The ward list. Point at the four state cards.                         | "Twenty-eight patients in four states. Two need review, twelve are waiting on a check-in, and two do not have enough data. Most tools cannot tell a quiet patient from one nobody can see." |
| Open **Maya Okafor**. Read down the left.                             | "Open one and you get the story, not a chart. Settled by day three, drifting on day seven, all four signals past threshold together for thirty-five hours, and no workout to explain it."   |
| Scroll to the readings table, then to **what the patient reported**.  | "Her own words sit beside the numbers. Pattern, context, follow-up options. The clinician decides."                                                                                         |

---

## 1:50–2:15 · The model and the pipeline

| Screen                                                                                     | Say                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scroll to **Model view**.                                                                  | "A second opinion runs beside the rule: an Isolation Forest fitted to this patient's own history, with a per-pathway prior trained on forty synthetic patients when history is thin."                              |
| Point at **against the recovery watch**.                                                   | "It never adds a signal that was not recorded, and where they disagree the rule decides."                                                                                                                          |
| Switch to the Render dashboard tab, Workflows, most recent run. Point at the execution ID. | "The analysis runs as a Render Workflow: normalise, baseline, check for coordinated change, compile the evidence. Every run has an execution ID, so any number on that screen traces to the run that produced it." |

---

## 2:15–2:42 · How the data is handled

| Screen                                                        | Say                                                                                                                                                                                                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Back to the app. Click **Security** in the clinician sidebar. | "The part most demos skip. Every technical safeguard in the HIPAA Security Rule, cite by cite. Nine built, one partial, and the partial is deliberate."                                                                                |
| Point at the live lines under encryption and integrity.       | "Two are read from the running process, not asserted: whether the data is encrypted, and whether the audit log verifies. Each entry carries the digest of the one before it, so an edited line breaks the chain."                      |
| Scroll to the second table.                                   | "And the half that matters: business associate agreements, risk analysis, workforce training, review board approval, FDA clearance. All not met, none fixable in software. We would rather show you the gaps than have you find them." |

---

## 2:42–2:55 · The close

| Screen                            | Say                                                                                                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The ward list, or the Relay logo. | "Relay never diagnoses, never scores risk, never escalates by itself. Every sentence it generates passes a runtime guard that blocks clinical claims. It surfaces a pattern and the patient's own words. A clinician decides." |

---

## If a judge asks, the numbers behind it

| Claim                         | Where it comes from                                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal baselines matter     | Across the 66 subjects with usable baselines, resting heart rate spans 31 beats while one person varies by about 2.4 day to day (`fixtures/calibration.json`)                                                                                           |
| False alarms                  | 3.35% of subject-days at the shipped 1.75 sd on a whole-series baseline; **6.04%** on the trailing baseline a deployment actually has. Quote the second, volunteer the first                                                                            |
| Speed                         | A coordinated change of two personal standard deviations is seen the next day, against five days for the same person's own noise                                                                                                                        |
| Sensitivity                   | **Unmeasured, and say so.** Nobody in the reference cohort deteriorated, so there is no positive class                                                                                                                                                  |
| Where the data came from      | LifeSnaps, a public research cohort: 71 subjects, 4,453 subject-days, used for calibration and cohort context. One team member's own Apple Health export for engineering validation. Twenty-eight synthetic patients in the demo. No patient data, ever |
| What the model was trained on | Synthetic only. Each prior is labelled in its own metadata: "contains no real measurements", 40 synthetic patients per pathway, split 24/8/8                                                                                                            |
| Tests                         | 73 JavaScript, 63 Python, two integration suites. One runs the Python language guard and its Node port over the same corpus and fails if they disagree phrase for phrase                                                                                |
| Is it a device?               | On our own reading, probably yes, and we concede it in writing. We fail Criterion 1 of the clinical decision support exemption, because analysing a pattern from a signal acquisition system is exactly what we do                                      |

---

## Known state at the time of writing

**The model view will not show an anomaly score or the gate ledger on the
deployed site.** The Render Workflow runs correctly and returns a real
execution ID, but the Python model inside it reports `unavailable`, because the
Workflow service was created by hand with `npm ci` as its build command and
never installs the Python dependencies. The web service installs them; the
Workflow does not, and the web service delegates to the Workflow whenever
`RENDER_API_KEY` and `RENDER_WORKFLOW_SLUG` are set.

The fix is one line in the Workflow service's build command:

```
npm ci --include=dev && pip install -r requirements.txt
```

and `PYTHON_VERSION` set to `3.12.11`, because scikit-learn 1.5 has no wheel
for 3.14. The model itself is fine: run it directly and it returns `fitted`,
a score of 0.418 for Maya, and all four gates.

**Until that is done**, narrate the model beat as written above. Everything in
it is true: the model exists, it is trained, it is measured, and it runs. Do
not point at an empty score and do not claim the model is scoring live. If you
would rather show it scoring than show the Workflow, unset
`RENDER_WORKFLOW_SLUG` on the web service and the model runs on the web service
instead, but you then lose the execution ID, which is the Render track's best
evidence.

Never describe the labelled fallback as a Render Workflow run. The app
distinguishes them and so should the narration.
