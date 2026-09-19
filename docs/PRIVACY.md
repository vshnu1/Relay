# Privacy and confidentiality

Relay is a prototype built for a hackathon, not a deployed clinical system.
This document is deliberately precise about the difference: what protects data
today, how the real data we trained against was handled, and what a production
deployment would have to add before it touched an actual patient. Overstating
any of this would be worse than saying nothing, so where something is not built,
it says so plainly.

## What is true today

- **Every patient in the app is synthetic.** The cohort shown in the recovery
  views is generated in `src/recovery/model/simulatedSource.js`. No real person
  is represented, and no real identifiers exist anywhere in the committed app.
- **Access is a single shared demo token.** The API (`server/index.js`) gates
  requests on one `APP_ACCESS_TOKEN`, required in production mode. This is a
  demo shared secret, not per-user authentication — it proves the request came
  from the demo, nothing about who is making it. The recovery front-end has no
  login at all; the Doctor/Patient switch is demo scaffolding, clearly labelled
  as such in the UI.
- **Consent is recorded before anything is shared.** A patient cannot submit a
  check-in without ticking the share-with-my-care-team consent box first
  (`src/recovery/patient/Checkin.jsx`). The check-in is not sent until they do.
- **No real patient data is in the repository.** Nothing committed contains a
  real name, contact detail, or clinical record for a real patient.

## The real wearable data we did use

Threshold calibration and the false-positive measurement used real wearable
data — but it is **consented first-party data from a team member, not patient
data**, and it is de-identified before anything is committed. The specifics are
in [DATA.md](DATA.md) and are not restated here; in summary:

- pseudonymous ids via **HMAC-SHA256** under a secret kept out of the repo
- a **consistent per-subject date shift** that preserves intervals and weekday
  structure while destroying every real date (HIPAA Safe Harbor treats a date
  finer than a year as an identifier)
- source and device strings collapsed to a device class

The **raw export is gitignored and never committed** — the root `data/`
directory, where the export is unpacked, is ignored via an anchored `/data/`
rule. Only the de-identified outputs (`fixtures/daily_deid.csv`,
`fixtures/evidence.json`) are in version control. See
[DATA.md](DATA.md#privacy-handling) for the pipeline and the `DEID_SECRET`
requirement.

## What production would require

None of the following is built. It is the honest gap between this prototype and
a system that could hold real patient records.

- **Per-account identity with role-based access.** Real clinician and patient
  accounts, authenticated individually, with authorisation that scopes each
  account to only the records it is entitled to see. The shared demo token
  would be removed entirely.
- **Audit of every record view, not only every action.** Today the model
  records actions (a check-in sent, a review acknowledged). A clinical system
  must also log every *read* — who opened which patient's record and when — so
  that access itself is accountable, not just changes.
- **Encryption in transit and at rest.** TLS for every connection and encrypted
  storage for every record and backup.
- **Business associate agreements with each device vendor.** Any wearable or
  hardware feed that carries identifiable health data (watch, oximeter, sensor)
  would need a BAA with its vendor before that data flowed through Relay.
- **A defined retention period.** An explicit policy for how long records are
  kept and a mechanism that deletes them when it expires — neither of which
  exists in the prototype.

## Where the boundary is enforced in code

Two of these commitments are executable rather than just documented, which is
worth noting because it means they cannot quietly drift:

- The de-identification pipeline (`pipeline/deidentify.py`) is what stands
  between the raw export and anything committed.
- `analysis/language_guard.py` enforces the product's clinical boundary on
  every clinician-facing string: Relay describes what changed and by how much,
  and never names a condition, a risk, a severity judgement, or a treatment
  recommendation. That is a confidentiality-adjacent guarantee — it keeps the
  system from asserting things about a patient it has no standing to assert.

## Update after the patient-view merge

Two controls changed and both strengthen the posture.

**Consent is now taken at sign-in, before any data is shown.** The patient
enters their hospital and discharge code and must tick "I agree to share my
readings and answers with my care team at this hospital for the 30 days after
discharge. I can stop at any time." The server independently refuses any
analysis for a patient whose consent is revoked (`server/index.js`, 401 on
`Monitoring consent has been revoked`), so the client control is not the only
one.

**Two sign-in mechanisms now coexist, deliberately.**

| | What it is | Enforced where |
|---|---|---|
| Discharge code | Hospital plus a per-patient code, binding one profile | Client, against the roster |
| Role access codes | One code per role, clinician or patient | Server, constant-time compare |

The discharge code identifies *which* patient, which a shared role code
cannot. The role code is the one the server actually enforces: without it
`/api/patients` returns 401, and a patient role gets 403 rather than the
ward. Neither is per-user authentication and neither is presented as such.

**What is still true.** Every patient is synthetic. No real identifier, date
of birth, or API key is committed, and the full history was checked, not just
the working tree. Raw health exports stay gitignored. The one real dataset
used for validation is de-identified with HMAC pseudonyms and an
interval-preserving date shift, documented in DATA.md.

**What production still needs**, unchanged from above: per-account identity
rather than shared codes, audit of every record view and not only every
action, encryption in transit and at rest, business associate agreements with
each device vendor, and a defined retention period. Discharge codes would
have to be issued by the hospital system and bound to an account rather than
living in a fixture.
