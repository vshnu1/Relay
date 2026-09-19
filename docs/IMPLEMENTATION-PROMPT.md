# Implementation prompt — frontend feature pass

Paste everything below into a fresh Claude Code session at the repo root.

---

You are working on Relay, a post-discharge remote monitoring prototype for
Bay Hacks 2026 (Nucleate Florida Healthcare Challenge). Submissions close
7:00 PM ET today, so prefer finishing three things well over starting five.

Read `docs/FEATURE-SPEC.md` first. It records which features already exist,
verified against the code, and why two commonly-requested ones are
deliberately not being built. Do not re-litigate those decisions.

## Before you start

```bash
git pull
npm ci && npm run build && npm test     # must be green before you touch anything
npm start                               # serves on :3001
```

The app you are changing is `src/recovery/`, which is the default view at the
root URL. The older workspace at `#/classic` is not in scope.

Patient records live in `src/recovery/model/simulatedSource.js` with the shape
`{ id, name, age, profile, day, stay, stories }`. Condition configuration —
which signals are counted, which are only recorded, and which questions get
asked — lives in `src/recovery/model/profiles.js`.

## Task 1 — Landing page (about 1.5 hours)

New route, shown when the hash is empty. Currently the root drops straight
into the clinician watchlist.

Three things on one page:

1. What Relay is. Use the one-sentence version from `docs/PITCH.md`, do not
   write a new one.
2. Two entry points: "I am a patient" routing to `#/patient`, and "I am a
   clinician" routing to `#/doctor`. Remember the choice in `sessionStorage`
   so a reload does not bounce the user back here mid-demo.
3. An honest strip, as prominent as the buttons: synthetic patients only,
   thresholds are demo settings and not clinically validated, not a medical
   device, no real patient data.

That third block is load-bearing for judging, not boilerplate. Do not bury it
in a footer.

**Done when:** the root URL shows the landing page, both buttons route
correctly, a reload after choosing does not return to it, and the build and
tests are still green.

## Task 2 — Patient context header (about 1 hour)

Today the clinician sees one line: "67 years old. Discharged with pneumonia,
day 9 of 30 at home." The patient sees "Day 6 of 30 at home" and a bar.

Expand both into a proper header carrying:

- reason for admission and what they were discharged with
- discharging hospital or unit, and the discharge date
- day N of M with the monitoring window stated
- which signals are watched for this condition and which are recorded but not
  counted — read this from `PROFILES[profile].counted` and `.recorded`, never
  hardcode it
- consent status and when it was given
- the responsible clinician

`hospital`, `dischargedOn` and `clinician` do not exist yet. Add them as three
strings per patient in `simulatedSource.js`. Everything else is already in the
model. Find where the 30-day window is defined rather than hardcoding 30.

Write the patient-facing version in plain language. The clinician version can
be denser.

**Done when:** both views show the full context, the watched-signal list is
read from the profile (verify by checking a COPD patient shows sleep as
counted and a pneumonia patient shows it as recorded), and tests are green.

## Task 3 — The patient app must not hold other patients' data (about 45 min)

`src/recovery/Root.jsx` loads the whole cohort with `useCohort()` and then
picks one patient. The patient app never renders anyone else, but the data is
in scope on the client.

Scope it so the patient app only ever receives its own record. Keep the
existing behaviour of pinning the acting identity once resolved — the comment
in `Root.jsx` explains why, and that reasoning is correct.

Then move the Doctor/Patient switcher into a strip clearly marked as a demo
control, reading something like "Demo only — a real deployment separates
these by account." Do not build authentication; see the spec for why.

**Done when:** the patient app's props and state contain no other patient's
record, the role switcher still works and is visibly labelled as a demo
affordance, and tests are green.

## Task 4 — `docs/PRIVACY.md` (about 30 minutes)

Write it. No code.

Cover what is true today: synthetic patients only, a single shared demo
token, consent recorded per patient before any check-in, no real identifiers
committed. Then the real wearable data we did use — de-identified with HMAC
pseudonyms and interval-preserving date shifts, raw exports gitignored and
never committed. `docs/DATA.md` has the specifics; cite it rather than
restating.

Then what production would require: per-account identity with role-based
access, audit of every record view rather than only every action, encryption
in transit and at rest, business associate agreements with each device
vendor, and a defined retention period.

Be accurate about what is not built. Overstating here is worse than saying
nothing.

## Task 5 — Expand the top signal by default (about 10 minutes)

In the clinician's "Readings, day by day" section, every signal is collapsed
and the section itself sits behind a link. Expand the highest-contributing
signal by default so the chart with the green usual-band is visible without a
click. Leave the rest collapsed.

## Hard constraints

- **Do not touch** `ml/`, `analysis/`, `shared/engine.js`, `server/index.js`,
  `workflows/`, or anything under `fixtures/`. Another person owns each of
  those and they are all currently green.
- **Do not add dependencies.** No new npm packages.
- **Do not build authentication.** `docs/FEATURE-SPEC.md` explains why, and
  the reasoning has been accepted.
- **Do not ingest lab results.** Out of scope, pending a decision.
- **Run every user-facing string through the language guard** before you
  finish:
  ```bash
  python3 analysis/language_guard.py "your new copy here"
  ```
  It must never say a patient is healthy, safe, at risk, or name a condition
  as a finding. Reword rather than adding an exception to the guard.
- **Keep `npm run build` and `npm test` green after every task.** If a task
  breaks them, finish or revert it before starting the next.

## Finishing

Commit each task separately with a message explaining the reasoning, not just
the change. Push to your own branch, then open a PR into `main`.

If you run short on time, the priority order is Task 1, 4, 2, 5, 3 — the
landing page and the privacy doc score most per minute, and Task 3 is
correctness work that matters least for the demo itself.

Report back with what you finished, what you skipped, and anything you found
that contradicts `docs/FEATURE-SPEC.md`.
