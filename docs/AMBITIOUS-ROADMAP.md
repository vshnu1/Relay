# Ambitious roadmap: what to build with the hours left

Researched, not guessed. Each item names the judge it speaks to, the evidence
behind it, and what already exists in the repo so the estimate is honest.

## The judges, and what each actually judges

| Judge | Role | What they will weigh |
|---|---|---|
| Jenn Bonilla, PhD | VP Portfolio Strategy, Moffitt Innovation & Entrepreneurship Office | A tech-transfer office. She judges ventures: value proposition, licensing path, and — at a cancer centre — whether oncology is in scope. |
| Urvish Gajjar | Senior Test Manager, Health Care Service Corporation | HCSC is Blue Cross Blue Shield. A payer, and a QA lead. Two audiences in one: readmission economics, and test rigour. |
| Alia Merchant | Director of Operations, Nucleate | Equity-free biotech accelerator. Venture readiness: team, commercialisation, scientific value proposition. |
| Zois Syrgiannis, PhD | CEO, NanoNeurosciences | Nanomedicine and drug delivery, not wearables. He will judge scientific rigour and translational pathway. The "gait for the neuro judge" idea does not hold; gait earns its place on other grounds below. |

## The economic frame nobody has said out loud yet

CMS's Hospital Readmissions Reduction Program penalises six conditions:
**acute MI, heart failure, pneumonia, COPD, hip/knee replacement, CABG.** The
window is 30 days. In FY2026 roughly 75% of the ~3,400 eligible hospitals pay
a penalty; the median is 0.69% of Medicare inpatient revenue and the statutory
maximum is 3%.

Relay's window is 30 days. Three of its programs — heart failure, pneumonia,
COPD — are HRRP conditions. That alignment exists by accident and is stated
nowhere. Saying it is free and it is the payer pitch.

## What the RPM literature says fails

A systematic review of 90 RPM studies found readmission reductions in 49%.
The failures cluster on three things Relay is already built against:

- **Alert fatigue.** One trial: the average patient generated 35 threshold
  alerts requiring staff contact over six months, with "no algorithms
  connecting signals with responses." The coordinated-deviation rule and the
  restraint ledger are the direct answer, and the 3.35% measured false-alarm
  rate is the number to say.
- **Generic feedback.** Feedback was "predominantly operational ... generic
  rather than personalised." Every model-driven message now names the
  discharge condition.
- **Wear and medication adherence.** Both are named failure modes, and
  neither has a feature yet. Items 5 and 6 below.

## Ranked

### 1. Import a real 99-day export live, on camera — verify, do not build

`src/recovery/model/healthImport.js` already reads an Apple Health
`export.zip` entirely in the browser: central directory, DecompressionStream,
`<Record>` scan, one value per day. Nothing is uploaded. The original
`export.zip` (15.1 MB, 284 MB inflated) is in Downloads.

A patient dragging in a real export and watching 99 days of their own
physiology appear is the strongest single demo moment available, and it is
~80% built. **Verify it handles the 284 MB inflation in-browser before
promising it.** Then add the gait record types (item 2) so the import carries
them too.

*Speaks to:* every judge. *Effort:* 30 min to verify, plus whatever breaks.

### 2. Hip and knee replacement — an HRRP condition powered by real gait data

The recovery markers after arthroplasty are walking speed, step length,
timing asymmetry and double-limb support, recovering over 13–24 weeks;
step count and gait speed already guide clinical decisions in RPM programs
for these procedures. The real export carries **1,451 days** of exactly those
signals at ~39 samples a day, and double-support varies only 6% within a
person.

Today: zero gait signals in the UI model, zero gait types in the importer,
and the ML `stroke_rehabilitation` program already has the metrics.

Build: five gait `SIGNALS`, their `TYPES` in the importer, a
`jointReplacement` profile, a `joint_replacement_recovery` ML program, two
patients. This becomes the one program the real data can drive end to end.

*Speaks to:* Gajjar (HRRP), Merchant (differentiation). *Effort:* ~2 h.

### 3. Oncology — post-chemotherapy neutropenic-fever watch

Febrile neutropenia is a serious complication of anticancer therapy that
needs same-day assessment; the REMEDY pilot and the THERMAL wearable study both use
**continuous temperature** for early detection, with one ECG-plus-temperature
study predicting events up to 18 hours ahead. Manual temperature entry is
already wired in the patient app.

Build: a `postChemotherapy` profile counting temperature, resting HR, HRV and
breathing; questions for fever, mouth sores (new), nausea, fatigue, medicine;
a mirrored ML program; two patients.

*Speaks to:* Bonilla directly — Moffitt is a cancer centre. *Effort:* ~1 h.

### 4. Promote weight to counted for heart failure

A gain of 2–3 lb overnight or 5 lb in a week is the classic decompensation
trigger. Weight is currently `recorded`, not `counted`, on the heart-failure
profile — the HRRP program's most important signal is the one Relay does not
watch. Manual weight entry exists; the importer reads `BodyMass`.

Build: `counted("weight")` with an absolute threshold, plus a cumulative
multi-day rule in `derive.js`.

*Speaks to:* Gajjar (HRRP HF is the largest penalty category), any clinician.
*Effort:* ~45 min.

### 5. Medication adherence as a signal, not a question

HF: 30–50% non-adherent; poor adherence drives **55% of decompensations** and
a 70% higher rehospitalisation rate. COPD: 51% non-adherent by electronic
monitoring. The `adherence` field is declared on all eleven profiles and
**consumed by nothing.**

Build: a daily "took my medicines" tap on the patient home screen, stored as
a signal with a streak; a missed-dose run becomes a counted deviation; the
clinician sees it beside the vitals.

*Speaks to:* Gajjar, Bonilla. *Effort:* ~1.5 h.

### 6. Device silence is not quiet

`schedule.js` has no notion of a watch that stopped syncing. RPM programs
fail on wear adherence as often as on medication. Build: detect a stale
source, nudge the patient on the home screen, and make the clinician's
"not enough data" say *unobserved for N days* rather than nothing.

*Effort:* ~1 h.

### 7. Direction of travel

"36 hours and still rising" and "36 hours and recovering" are clinically
different and read identically today. *Effort:* ~1 h.

### 8. Say the HRRP alignment on the clinician home

One panel: three programs are CMS HRRP conditions, the window is HRRP's
window, 75% of hospitals pay, median 0.69%, max 3%. Then the operational
line: *20 patients, 2 need review today — against 20 manual chart checks.*
Not a risk prediction; a description of the work.

*Speaks to:* Gajjar, Merchant, Bonilla. *Effort:* ~45 min, mostly copy.

### 9. Make the test rigour visible

Gajjar is a Senior Test Manager. 32 JS tests, 53 ML tests, an API
integration suite, Python converter tests, a guard-parity check, and a
false-alarm rate measured on 71 real subjects. A validation section in the
README, with the numbers. *Effort:* 20 min.

## Do not build

LLM synthesis (templates plus the guard are the differentiation), real
per-user auth, a caregiver role, real device OAuth, and anything that makes
the model the decider.

## Suggested order

1 → 2 → 3 → 4 → 5 → 6 → 8 → 7 → 9. About nine hours with margin, each item
independently shippable, and the video can be recorded after any of them.

## Sources

- [Moffitt Innovation & Entrepreneurship Office](https://www.moffitt.org/research-science/academic-and-industry-partnerships/office-of-innovation/)
- [Nucleate Activator](https://nucleate.org/activator/)
- [UF Innovate on NanoNeurosciences](https://innovate.research.ufl.edu/2024/07/24/tech-tuesday-nanoneurosciences/)
- [CMS HRRP](https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-readmissions-reduction-program-hrrp) · [FY2026 penalties](https://safetynetalliance.org/hospitals-to-face-more-readmissions-penalties-in-2026/)
- [RPM systematic review, npj Digital Medicine](https://www.nature.com/articles/s41746-024-01182-w) · [Remote biometric sensing meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC12954359/)
- [REMEDY pilot, febrile neutropenia](https://www.jhoponline.com/issue-archive/2026-issues/august-2026-vol-16-no-4/remote-outpatient-temperature-monitoring-for-early-detection-of-febrile-neutropenia-after-high-dose-cytarabine-consolidation-chemotherapy) · [THERMAL wearable study](https://pmc.ncbi.nlm.nih.gov/articles/PMC12611175/)
- [Arthroplasty remote monitoring RCT](https://pubmed.ncbi.nlm.nih.gov/33346847/) · [Gait metrics after hip/knee/spine surgery, scoping review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10617143/)
- [HF medication adherence and outcomes](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10039095/) · [Non-adherence and readmission](https://www.dovepress.com/the-association-between-medication-non-adherence-and-early-and-late-re-peer-reviewed-fulltext-article-IJGM)
