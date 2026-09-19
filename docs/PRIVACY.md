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
  and never states a diagnosis, a risk, a severity judgement, or a treatment
  recommendation. That is a confidentiality-adjacent guarantee — it keeps the
  system from asserting things about a patient it has no standing to assert.
