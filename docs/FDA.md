# Is Relay a medical device?

Short answer: **on our own reading, probably yes.** This document works through
the statutory criteria and concedes the one we fail, because the alternative —
claiming the Clinical Decision Support exemption and being wrong — is the worse
position to be caught in.

Nothing here is legal advice and none of it has been reviewed by counsel or by
FDA. It is the assessment a team would bring to a pre-submission meeting, not
the answer to it.

## The rule

The 21st Century Cures Act § 3060 added FD&C Act § 520(o) (21 U.S.C. § 360j(o)),
which excludes certain software from the device definition. Clinical Decision
Support is § 520(o)(1)(E), and **all four** criteria must hold:

1. **not** intended to acquire, process or analyse a medical image, a signal
   from an in-vitro diagnostic device, **or a pattern or signal from a signal
   acquisition system**;
2. intended for displaying, analysing or printing medical information about a
   patient;
3. intended for supporting or providing **recommendations** to a health care
   professional about prevention, diagnosis or treatment; and
4. intended for **enabling the professional to independently review the basis**
   for those recommendations, so that they do not rely primarily on them.

FDA issued a final *Clinical Decision Support Software* guidance in **January
2026** (docket FDA-2017-D-6569), superseding the September 2022 version. Two
changes matter here: "not time-critical" moved out of Criterion 3 and into the
Criterion 4 analysis, and a new enforcement-discretion policy covers some
single-output functions that otherwise meet all four criteria.

## Criterion by criterion

### Criterion 1 — we fail this

Relay reads continuous wearable streams. Measured on the one real export in
this repository (`docs/INTEROP.md`): **3,818 heart-rate samples a day**, 369
respiratory, 90 blood-oxygen, and roughly 39 gait. `pipeline/aggregate.py`
bins them into six-hour windows, and `shared/engine.js` will not surface
anything until **three consecutive windows spanning at least 24 hours** agree.

That is, in the statute's own words, a pattern from a signal acquisition
system. The design does not skirt the criterion; it is built on the thing the
criterion excludes. Coordinated persistent change across several streams *is*
the product.

One argument is available and we do not think it survives. A consumer wearable
is not, in general, measuring for a medical purpose. But `profiles.js` is
indexed by discharge condition — `heartFailure` watches morning weight and
resting heart rate *because* of heart failure, with a threshold chosen for it.
The medical purpose is supplied by our own intended use, so we cannot then
disclaim it.

**The language guard does not help here.** `server/languageGuard.js` prevents
Relay from stating a clinical meaning, and that is worth what it is worth under
Criterion 1's "interpret the clinical implications" prong — but the criterion
also excludes software that *acquires, processes or analyses* the pattern at
all, and Relay plainly does.

### Criterion 2 — probably fails as a consequence

FDA treats "medical information" as clinical-encounter material: demographics,
symptoms, test results, discharge summaries, practice guidelines. Relay's
check-in answers and discharge context are squarely that, and on their own
would satisfy this criterion. The wearable-derived flagging path is what does
not, and in FDA's published examples Criterion 2 tends to fall wherever
Criterion 1 does.

### Criterion 3 — we are strong here

Relay provides no diagnosis, no risk score, no severity grade, no treatment
direction, and it escalates nothing by itself. It produces a list of follow-up
options for a clinician after a hospitalisation, which is the kind of output
this criterion contemplates.

This is enforced at runtime rather than promised: every generated sentence
passes `server/languageGuard.js` before it leaves the process, against five
rule families — diagnostic claim, risk prediction, severity judgement,
treatment recommendation, autonomous escalation. A sentence that trips one is
replaced with a description of the readings and the redaction is recorded in
`guard.withheld` and shown to the clinician. `analysis/language_guard.py` is
the Python original and a test asserts the two agree phrase for phrase.

Two honest qualifications. "Review recommended" is a **single** output rather
than a list of options, which places it in the January 2026 enforcement
discretion policy rather than cleanly inside the criterion. And the watchlist
is **pull, not push** — Relay never alerts anyone. That is load-bearing: adding
a notification would materially worsen Criteria 3 and 4, and should not be done
without revisiting this document.

### Criterion 4 — our best criterion

The monitoring window is thirty days and nothing is surfaced until a change has
persisted 24 hours. Relay is structurally incapable of being time-critical,
which is where the 2026 guidance moved that consideration.

| What the guidance asks for | Relay |
|---|---|
| Purpose and intended use, including the intended user | Stated in the clinician view and in this document |
| The input information required | `profiles.js` counted and recorded signals, shown on every patient |
| Plain-language description of development **and validation, including clinical validation results** | Development: yes — the gate ledger in the model view shows each threshold and whether it was met. **Clinical validation: none exists.** See `docs/DATA.md` |
| Output gives patient-specific information and its knowns and unknowns | Readings, thresholds, cohort comparison, an explicit `insufficient_data` state, and the count of withheld sentences |

## Conclusion

Relay is most likely **device software**. It fails Criterion 1 on its inputs,
and the two criteria it was deliberately engineered to satisfy — 3 and 4 — are
the two it is least likely to fail. The engineering was not wasted: it is the
difference between a device that is transparent and restrained and one that is
not. It does not move the product outside the definition.

### What would change the answer

Ingesting only **discrete, point-in-time vitals** entered at a clinical
encounter, rather than continuous streams, would avoid the pattern analysis
Criterion 1 excludes. It would also be a different product — the entire claim
here is that coordinated drift between visits is visible where a single reading
at a visit is not — so this is recorded as an option, not a plan.

The general wellness policy does not rescue it either. That exception requires
an intended use unrelated to a disease or condition, and `profiles.js` is
indexed by condition.

### What a real submission would need

A pre-submission (Q-Sub) meeting with CDRH; an SaMD risk categorisation; a
510(k) or De Novo determination; a quality system under 21 CFR 820 / ISO 13485;
and the clinical validation `docs/DATA.md` is explicit about not having.

## Why this document exists

A reviewer who knows this area will reach Criterion 1 within a minute of
understanding what Relay ingests. Conceding it in writing, with the reasoning
and the mitigation, is worth more than a claim of "non-device clinical decision
support" that does not survive the first question.
