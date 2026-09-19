# Feature drafts: verified against the code

_Re-verified against the code on 19 September 2026. The tables below were
written against a five-condition, eight-question version of `profiles.js`; there
are now 15 recovery pathways and 23 questions, and the counted and recorded
lists had each gained signals. A document titled "verified against the code" is
worse than no document when it stops being true, so the numbers here are read
out of `profiles.js` rather than remembered._

Each item checked against what is actually built. Four of nine already exist
in full, which changes what the remaining hours should go to.

Written at roughly T-18h. Effort estimates assume one person and include
testing, not just typing.

---

## 1. Personalised signals per discharge condition — BUILT

> "Depending on the discharge it shows different ones because some discharges
> maybe don't matter about your sleep quality."

Exactly this exists. `src/recovery/model/profiles.js` splits every condition's
signals into `counted` and `recorded`:

| Condition           | Counted                                               | Recorded but not counted                        |
| ------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| Pneumonia           | breathing, resting HR, skin temp, oxygen              | hrv, sleep, deep sleep, walking HR, temperature |
| Heart failure       | resting HR, hrv, breathing, walking HR, sleep, weight | oxygen, deep sleep                              |
| Abdominal surgery   | resting HR, hrv, breathing, skin temp                 | sleep, oxygen, walking HR, temperature, pain    |
| COPD flare-up       | breathing, oxygen, walking HR, sleep                  | resting HR, hrv, temperature                    |
| Atrial fibrillation | resting HR, hrv, average HR                           | sleep, breathing, weight                        |

Your example is literally right: **COPD counts sleep, pneumonia does not.**
And the UI already says so out loud — "Sleep is 5.9 hours against a usual
7.2. Not counted for pneumonia", plus "4 more signals are recorded but not
counted for pneumonia."

The ML layer has the same split independently in `ml/relay_ml/programs.py`
(`metrics` vs `core`) across 14 programs.

**Do nothing. Demo it instead** — it is one of the strongest things you have
and nobody currently points at it.

## 2. Personalised check-in questions per condition — BUILT

> "Personalized questions per check-in for the condition on the patient-side view."

`PROFILES[condition].questions` selects from 23 defined question types:

| Condition           | Asks                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------- |
| Pneumonia           | breathing, cough, fever, hydration, fatigue, medicine, activity                       |
| Heart failure       | breathing, **swelling**, fatigue, dizziness, medicine, activity                       |
| Abdominal surgery   | **pain**, **wound**, nausea, breathing, fever, fatigue, medicine, activity            |
| COPD                | breathing, **cough**, **mucus**, **inhaler**, **oxygen**, fatigue, medicine, activity |
| Atrial fibrillation | **racing heart**, **chest pain**, dizziness, breathing, fatigue, medicine, activity   |
| Sleep apnoea        | sleepiness, breathing, **nights without the CPAP machine**, activity                  |
| After chemotherapy  | fever, **mouth sores**, nausea, fatigue, medicine                                     |

Heart failure asks about swelling; abdominal surgery asks about pain; AF asks
about a racing heart. `ml/relay_ml/programs.py` carries the same idea as
`context_fields`, and stroke rehabilitation adds falls and dizziness.

**Do nothing.** Same note: show it. Two patients with different questions on
screen makes the point instantly.

## 3. Day-by-day readings clearer — BUILT, one small change worth making

The grid exists: one square per day per counted signal, shaded by distance
from that patient's usual, hatched for the hospital stay and days with no
reading, with a bracket marking the 38-hour window. Expanding a signal shows
the readings against a green "usual" band and the rule in plain words —
"Counted when 10% higher for 24 hours."

The only real issue is **discoverability**: the section sits behind a
"Day-by-day readings are below" link and every signal is collapsed.

**Change:** expand the top contributing signal by default, so the chart is
visible without a click. Ten minutes, removes a click from the demo.

## 4. Doctor and patient on separate pages — PARTLY BUILT

Routing separation already exists: `#/doctor` and `#/patient` are distinct
pages rendering `DoctorApp` and `PatientApp`. They share no components.

What does not exist is **access control**. A demo bar at the top lets anyone
switch roles, and the acting patient is chosen from `sessionStorage` with a
fallback to whoever has questions waiting.

**Flesh out, honestly:** do not fake authentication. Instead make the role a
deliberate entry choice and label the switcher as what it is.

- Landing page (item 5) routes to one role, and the app remembers it
- The switcher moves into a clearly marked "Demo controls" strip, reading
  "Demo only — a real deployment separates these by account"
- The patient app never renders cohort data for anyone else. Worth an
  explicit check: today `Root.jsx` loads the whole cohort and picks one.

That last point is the only real leak, and it is worth fixing regardless of
the demo, because a judge asking "could a patient see another patient?"
deserves a better answer than "not in practice".

**Effort:** 45 minutes. **Risk:** low, no new dependencies.

## 5. Proper landing page — MISSING, highest value of the remaining items

Nothing exists. The root URL drops you straight into the doctor watchlist.

**Flesh out:** one page, three things.

1. What Relay is, in the one-sentence version already written in `PITCH.md`
2. Two entry points — "I am a patient" and "I am a clinician"
3. A short, honest strip: synthetic patients, demo thresholds, not a medical
   device, no real patient data

That third block is doing double duty. It is the first thing a judge sees,
and it answers the Nucleate privacy criterion before anyone has to ask.

**Effort:** 1–1.5 hours. **Risk:** low. It is a new route, touching nothing.

## 6. Discharge and patient context clearer — PARTLY BUILT

Today the doctor view has one line: "67 years old. Discharged with pneumonia,
day 9 of 30 at home." The patient view has "Day 6 of 30 at home" and a
progress bar.

**Flesh out** into a proper header on both sides:

- reason for admission, and what they were discharged with
- discharging hospital or unit, and the discharge date
- day N of M, with the monitoring window stated
- which signals are being watched for this condition, and which are not
- consent status and when it was given
- who the responsible clinician is

Most of this is presentation of data the profiles already carry. The fields
that do not exist yet — hospital, discharge date, clinician — are three
strings per patient in the fixture.

**Effort:** 1 hour. **Risk:** low.

## 7. Accounts, login, confidentiality — DO NOT BUILD. Document instead.

The server has a single shared `APP_ACCESS_TOKEN`, required in production.
The recovery app has no auth at all.

Real per-user authentication is several hours, and with synthetic patients it
would protect nothing. Building fake login screens at hour 18 costs demo time
and earns nothing — a judge can tell the difference.

**What actually scores** on the Nucleate criterion is the design being
explicit. Write a short `docs/PRIVACY.md` covering what is true today and
what production would require:

- today: synthetic patients only, single shared demo token, consent recorded
  per patient before any check-in, no real identifiers anywhere in the repo
- our own real data: de-identified with HMAC pseudonyms and interval-preserving
  date shifts, raw exports gitignored and never committed (already true, see
  `docs/DATA.md`)
- production would need: per-account identity with role-based access, audit
  of every record view not just every action, encryption at rest and in
  transit, BAAs with each device vendor, and a defined retention period

**Effort:** 30 minutes of writing. **Risk:** none. Higher scoring value per
minute than a login form.

## 8. Demo sequence: patient first, then clinician — RUNBOOK CHANGE ONLY

> "Show patient view, the user, and then we'll go, okay now let's show this
> is what the doctor will see."

Nothing to build, and it is a better order than the current runbook, which
starts on the watchlist. Seeing the question asked and then the answer land
in the clinician's evidence is the strongest thirty seconds in the product.

**Revised order:** patient app, day 6 of 30, "your care team has a few
questions" → answer them → switch to clinician → Maya now reads "Review
recommended" with those answers and her own words in the evidence.

**Effort:** rewrite five paragraphs of `DEMO-RUNBOOK.md`. Free.

## 9. "Labs process" — NEEDS CLARIFICATION, do not start

> "Labs process of this or we have to implement that"

Ambiguous, and the two readings have very different costs.

- **Lab results as a data source** (bloodwork, cultures, inflammatory
  markers): a new input with no device behind it, and both `first build.md`
  and the Relay spec exclude labs. Post-discharge patients are not having
  daily bloods drawn at home. This looks like scope you should decline.
- **The clinical workflow / process** this fits into: worth one paragraph in
  the pitch — where the review item lands, who acts on it, what happens next
  — and that is already partly covered by the FHIR handoff.

**Say which you meant before anyone starts.**

---

## Recommendation, given the clock

Build, in order:

1. Landing page — 1.5h, first thing a judge sees, carries the privacy framing
2. Patient context header — 1h, both views
3. Patient app cannot load other patients — 45m, closes the real leak
4. `docs/PRIVACY.md` — 30m, best scoring value per minute here
5. Expand the top signal by default — 10m

That is about 4 hours of work with margin, and none of it touches the
analysis engine or the ML layer.

Do not build: authentication, lab ingestion, or anything that requires a new
dependency.

Demo rather than build: per-condition signals and per-condition questions.
They are done, they are good, and right now nothing in the pitch points at
them.
