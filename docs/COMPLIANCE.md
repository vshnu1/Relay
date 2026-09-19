# What would be required to run this for real

Relay holds nothing but synthetic records and one consenting team member's own
de-identified export. **It is not HIPAA compliant and this document does not
claim it is.** Compliance is an organisational state — agreements, risk
analyses, trained staff, an incident procedure — and a weekend project cannot
enter that state. What it can do is build the parts that are technical, and be
precise about which parts are not.

Each row below is marked **built**, **written** (documented, not implemented)
or **organisational** (impossible here, and named so nobody assumes otherwise).

Related: [FDA.md](FDA.md) on whether this is a regulated device (our reading:
probably yes), [PRIVACY.md](PRIVACY.md) on the de-identification, and
[DATA.md](DATA.md) on what the numbers do and do not establish.

## Which law would even apply

This matters more than it sounds, because the answer changes with the business
model and most health apps get it wrong in the same direction.

| Deployment                           | Regime                                                                | Consequence                                                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracted to a discharging hospital | **HIPAA business associate**, 45 CFR 160.103                          | Security Rule applies directly; BAAs required down the chain                                                                                  |
| Sold directly to patients            | **Not HIPAA at all.** FTC Health Breach Notification Rule, 16 CFR 318 | A "vendor of personal health records" — Relay draws from multiple sources by design, wearable streams plus patient answers, which is the test |
| Either, with Washington users        | **My Health My Data Act**, RCW 19.373                                 | The only US consumer health privacy law with a **private right of action**                                                                    |

The demo represents the first. Teams routinely assume HIPAA is the ceiling; for
a direct-to-consumer wearable app the FTC rule and state law are what actually
bite, and the FTC's 2024 amendments made an unauthorised _disclosure_ — an
analytics SDK, a misconfigured third-party call — a reportable breach.

## HIPAA Security Rule, technical safeguards (45 CFR 164.312)

| Cite        | Safeguard                                 | Status                                                                                                                                                                                                                                                                                                              |
| ----------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a)(1)      | Access control                            | **Built.** Role gate, an allow-list of the routes the patient view uses, constant-time code comparison, deny by default, and a patient scoped server-side to the one record their discharge code opens                                                                                                              |
| (a)(2)(i)   | **Unique user identification** (required) | **Built.** Named accounts, scrypt-hashed passwords, and an audit line that carries the acting person rather than only their role (`server/accounts.js`). _Was: two shared codes._ Still missing multi-factor authentication and any check that an account belongs to the clinician it names                         |
| (a)(2)(ii)  | Emergency access (required)               | **Built.** A break-glass grant needs a reason in a sentence, lasts fifteen minutes, is audited with that reason, and is displayed on the security page while open. _Was: no path at all_                                                                                                                            |
| (a)(2)(iii) | **Automatic logoff**                      | **Built.** 15 minutes idle, warned at 14, activity measured from real user events (`src/recovery/idleSignOut.jsx`), and now a server-side session store with a 12-hour ceiling, so signing out ends the session instead of clearing the tab. _Was: the credential stayed valid because there was nothing to revoke_ |
| (a)(2)(iv)  | Encryption at rest                        | **Built.** AES-256-GCM over state, the account store and every audit line, under `RELAY_DATA_KEY` (`server/vault.js`). With no key the server writes what it wrote before and the security page reports it unencrypted, so a missing key degrades rather than breaking a deploy                                     |
| (b)         | **Audit controls**                        | **Built.** Every access recorded with the acting person and role — record views, roster views, recovery-log reads, consent changes, acknowledgements, exports, imports, sign-ins, emergency access — carried through the model's awaits by an `AsyncLocalStorage` so one request cannot be attributed to another    |
| (c)(1)      | Integrity                                 | **Built.** Atomic write via temp-and-rename, and the audit log is a hash chain: each line commits to the one before it. _Was: Partial, because nothing prevented editing the log afterwards_                                                                                                                        |
| (c)(2)      | Authenticate ePHI                         | **Built.** `verifyChain()` walks the log and reports the line number where the history stops adding up. The digest covers the bytes as written, so the chain is checkable by someone holding the file and no key                                                                                                    |
| (d)         | **Person or entity authentication**       | **Built.** A password checked in constant time against a stretched hash, exchanged for a revocable server-side session. This authenticates an account, not a human being: identity proofing and a second factor are what a hospital deployment adds                                                                 |
| (e)(1)      | Transmission security                     | **Built.** TLS terminated by Render; HSTS in production; a CSP with **no third-party script origin**, nosniff, frame denial, `Referrer-Policy: no-referrer`, restrictive permissions policy, same-origin check on writes                                                                                            |

`GET /api/safeguards` reports what the running process is actually doing —
encryption mode, chain length and whether it verifies, whether accounts are
required — so the page states the live position rather than this document's
intention.

### Why this was built rather than bought

A hosted identity provider is the right answer for a real deployment, and the
security page says so. It was the wrong answer here for two reasons that have
nothing to do with the hours available.

Every such provider serves its SDK from its own origin. This application's
policy is `script-src 'self'` with no third party listed, and transmission
security is built partly on that: the argument on the page is that not even a
font request tells anyone who opened a record, which is why the typefaces are
self-hosted. Putting a third party's JavaScript on the authentication path of a
health application would trade a safeguard that is met for two that could be met
another way.

And on any free tier it buys identity without a business associate agreement.
Clerk and Auth0 both gate HIPAA support and a BAA behind enterprise plans, so
the compliance position would not move at all — only the vendor list would grow.

### The one that mattered most — now fixed

`GET /api/recovery/events` used to accept **any** `patientId` from a
patient-role caller. The shared code says "a patient", not "which patient", so
the server had nothing to check the requested record against: one signed-in
patient could read another's check-ins by editing a query parameter, and the
same held for writes.

The discharge code was already a per-patient secret — it was simply only ever
checked in the browser, and a check that only happens in the browser is not a
check. It is now presented on every request and verified server-side against
the roster, so a patient reaches exactly one record:

| Request                                             | Before   | Now         |
| --------------------------------------------------- | -------- | ----------- |
| Patient role code alone, asking for another patient | 200      | **403**     |
| Holding Nathan's discharge code, asking for Maya    | 200      | **403**     |
| Holding Nathan's discharge code, asking for Nathan  | 200      | 200         |
| An invented discharge code                          | 200      | **403**     |
| Clinician, any patient                              | 200      | 200         |
| Patient writing to another patient's record         | accepted | **dropped** |

This does not make the scheme equivalent to per-user accounts. The discharge
code is still shared with anyone the patient shows it to, it does not expire,
and it still cannot distinguish two people using one patient's code — so
(a)(2)(i) unique user identification and (d) person authentication remain
unmet. What it does close is the part that was indefensible: reaching a record
you hold no credential for at all.

Every such access is also **recorded**, which is what turns an unauthorised
read into one a breach investigation can find.

## Other HIPAA obligations

- **Minimum necessary** (164.502(b)) — partly built by accident of design: the
  roster strips raw events, and the patient role cannot list the ward. But
  `GET /api/patients/:id` returns the entire record including every event to
  any clinician code. _Field-level scoping is feasible and not done._
- **Right of access** (164.524) — a patient may have their record, in the
  electronic form requested, within 30 days. **Relay has no patient-facing
  export.** The FHIR endpoint is clinician-only and exports only _flagged_
  observations, which is not a record. _Written, not built._
- **Business associate agreements** (164.502(e)) — needed with every processor
  touching PHI. Two are checkable today and both fail: Render signs a BAA only
  on Scale or Enterprise workspaces and `render.yaml` specifies `starter`;
  ElevenLabs offers one only on Enterprise with Zero Retention Mode. The voice
  routes send a first name, the recovery pathway and a readings summary
  off-platform, plus the patient's own speech, which is why the server refuses
  a voice session for any record outside the synthetic roster. _Organisational — but the procurement gap is real and named._
- **Breach notification** (164.400–414) — individuals without unreasonable
  delay and no later than 60 days; HHS within 60 days at 500+ affected. As a
  business associate Relay would notify the hospital, not patients.
  _Organisational._

## Washington My Health My Data, if there are Washington users

- A **separate published consumer health data privacy policy**, distinct from a
  general one. _Not built._
- **Two consents, not one**: collection, and separately sharing. Relay takes a
  single combined consent at sign-in. The server does independently refuse
  analysis on revoked consent, and re-checks after the pipeline runs in case it
  changed mid-flight, which is a genuine two-sided control. _Partial._
- A **right to delete**, reaching backups and processors. **No deletion exists
  anywhere in the codebase.** _Not built, and feasible._

## Interoperability

The FHIR export (`GET /api/patients/:id/fhir`) is a plausible mock, not a
conformant bundle. Missing for US Core: LOINC codes on observations, UCUM
units, `Observation.category`, `meta.profile`, `Bundle.entry.fullUrl` so
references resolve, and — the substantive one — any `Device` or `Provenance`
resource saying these readings are **wearable-derived rather than
clinician-measured**. A receiving system cannot currently tell. It also exports
only flagged observations, so it is a summary rather than a record.

_Feasible and not done. This is the highest ratio of credibility to effort left
in the project: the bundle could be validated against the public HL7 validator
and the output committed._

## Accessibility

**WCAG 2.1 AA** is the operative standard, reaching a service like this through
ACA Section 1557 (45 CFR 92.204) rather than Section 508, which binds federal
agencies and reaches vendors through procurement. HHS extended the compliance
date for recipients with 15+ employees to **May 11, 2027**; the standard itself
did not change.

This matters here more than most places: several demo patients are 63 to 74,
and the product's premise is that they use it at home unsupervised.

See the accessibility audit findings for what was measured and fixed.

## Reimbursement, which shapes what must be recorded

CMS remote physiological monitoring codes impose data requirements a product
has to be built for:

| Code  | Requires                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------- |
| 99453 | Setup and education; at least 2 days of monitoring                                                       |
| 99454 | **16 days of data in 30** — the one that shapes the product                                              |
| 99457 | **20 minutes** of management time **and** one interactive synchronous two-way communication in the month |
| 99458 | Each additional 20 minutes                                                                               |

**Relay records none of this.** A billing-readiness panel — distinct days with
a transmission in the last 30, and accumulated interactive minutes this month,
with the voice check-in timed as the synchronous contact — is derivable from
the event log that already exists. _Feasible and not done. It is also the
answer to "how does this get paid for", which a judge will ask._

## Clinical validation

`docs/DATA.md` is explicit that nothing here is clinically validated, that the
false-alarm rate is measured on people who were not deteriorating, and that
sensitivity against real deterioration is unmeasured because no such cohort
exists in the data. That candour is the most defensible thing in the
repository.

Making any clinical claim would need IRB review under 45 CFR Part 46, a
prospective cohort, and reporting against the standard matching the design —
**TRIPOD+AI** for a prediction model, **DECIDE-AI** for early live evaluation,
**SPIRIT-AI** and **CONSORT-AI** for a trial protocol and its results.
_Organisational._

## Honest summary

Built: **nine of the ten technical safeguards in 45 CFR 164.312**, the tenth Partial and explained — transport security
and headers, automatic logoff with a revocable server-side session, audit
controls with per-person attribution over a hash chain, encryption at rest,
named accounts, emergency access, role separation with a deny-by-default
allow-list — plus consent enforced on both sides, de-identification under a
secret that is not in the repository, and a runtime boundary on every generated
sentence.

Not built and feasible: patient data export, deletion, FHIR conformance,
field-level minimum-necessary scoping, billing-readiness counters, multi-factor
authentication, identity proofing.

Not possible here: BAAs, risk analysis, workforce training, breach procedures,
IRB, and FDA clearance.

**A service that had the whole first list and none of the third would still not
be compliant**, and that is now the more important half of this document rather
than the caveat at the end of it. Holding every technical safeguard is a
property of a program. Compliance is a state an organisation is in. The security
page carries both tables for that reason: a page showing only the green one
would be the kind of document this project was written to avoid.
