# Remote Monitoring Intelligence Platform - Build Handoff

> Working name only: replace throughout once the team selects a final name.

## One-line description

A provider-facing out-of-hospital monitoring platform that turns fragmented remote-health data into a patient-specific, auditable statistical evidence summary for clinician review.

## The problem

Patients generate more remote health data than care teams can realistically interpret. Wearables, continuous glucose monitors (CGMs), blood-pressure cuffs, pulse oximeters, symptoms, medication events, sleep, and activity are often fragmented across separate systems. Providers must manually inspect charts and disconnected trends to determine whether anything changed together and whether the patient should be reviewed.

## The product

The platform combines simulated remote signals into one normalized patient timeline. It compares each signal to the individual patient's own baseline, detects persistent coordinated statistical deviations, gathers missing context through a brief patient check-in, and produces one evidence-backed review item for the care team.

It is **not** a diagnostic, risk-prediction, treatment-recommendation, or autonomous escalation product. A clinician retains all medical judgment.

## Core pitch

> Patients generate more remote health data than care teams can realistically interpret. Our platform turns fragmented wearable, CGM, home-vital, medication, and symptom data into one patient-specific clinical story. Instead of waiting for one vital to cross a generic threshold, it identifies persistent coordinated deviations from the patient's own baseline, collects missing context, and presents one auditable evidence summary for provider review. The result is less manual data review and a scalable way to extend monitoring beyond the hospital.

## The key differentiation from WHOOP or a patient sending screenshots

WHOOP and other devices display device-specific wellness data to the patient. This product does not try to replace them. It performs work that a provider cannot practically do from screenshots:

1. Normalizes data from multiple sources onto one time axis.
2. Compares signals to the patient's individual baseline rather than a single universal threshold.
3. Detects a **persistent coordinated pattern** across multiple systems instead of reacting to one isolated measurement.
4. Requests structured patient context when passive data is ambiguous.
5. Produces one source-linked evidence summary and a mock EHR handoff.

## System boundaries and safe language

### The system may say

- "Statistical review trigger"
- "Provider review suggested"
- "Resting heart rate is 14% above the patient's baseline for 36 hours."
- "Four contributing signals are shown below."
- "Context is incomplete; a patient check-in was requested."
- "No recent exercise was reported."

### The system must not say

- "The patient has an infection."
- "High risk of deterioration."
- "This is clinically dangerous."
- "Change medication."
- "Escalate treatment."
- "Contact the patient immediately."

The interface should say **why the event was flagged**, never why it medically matters.

## AI responsibilities: only three

### 1. Synthesize

Combine the measured deviations and patient-provided context into one short review item.

### 2. Explain

List the exact signals, baseline differences, durations, timestamps, source devices, and data-quality notes. The summary must be traceable to the underlying data.

### 3. Ask for missing context

When the deterministic analysis labels a pattern as ambiguous, initiate a short consented voice or text check-in. Examples:

- Any recent exercise or unusually strenuous activity?
- Any new or worsening pain?
- Any fever, nausea, dizziness, or wound changes?
- Were any medications missed or changed?

The AI does **not** detect the medical condition. The deterministic statistical engine identifies the deviation; the AI presents facts and collects structured context.

## Technical architecture

```text
Simulated device feeds / check-ins
  CGM, wearable, BP, pulse ox, sleep, activity, medication events
                         |
                         v
                  API + normalized event store
                         |
                         v
                  Render Workflow orchestration
                         |
       +-----------------+------------------+
       |                                    |
       v                                    v
baseline/deviation analysis        data-quality / missing-context check
       |                                    |
       +-----------------+------------------+
                         v
             statistical evidence object
                         |
          ambiguous? ----+---- no --> clinician evidence summary
                         |
                        yes
                         v
              ElevenLabs patient check-in
                         |
                         v
        structured answers posted back to API
                         |
                         v
          Render Workflow rebuilds summary
                         |
                         v
  provider portal + mock FHIR Observation / Communication / Task
```

## Render Workflows integration

Render must be used for the actual workflow, not just deployment, to qualify for Best Use of Render.

Create a workflow service with these task functions:

1. `ingestAndNormalize(patientId, events)`
   - Validates and normalizes timestamps, units, device source, and measurement type.
   - Stores only synthetic/demo records during the hackathon.

2. `calculateBaseline(patientId)`
   - Uses a rolling historical window supplied with synthetic data.
   - Calculates each signal's mean/median, variance, and data sufficiency.

3. `detectCoordinatedDeviation(patientId)`
   - Applies transparent rules such as: multiple signals exceed their individual deviation threshold and persist over a configured duration.
   - Produces a source-linked evidence object, not a diagnosis or clinical risk score.

4. `requestContext(patientId, evidenceId)`
   - Runs only when the event is statistically ambiguous or a required contextual field is missing.
   - Creates a check-in request for ElevenLabs.

5. `compileReviewItem(patientId, evidenceId)`
   - Combines the deterministic evidence with patient-entered check-in responses.
   - Generates the provider-facing evidence summary and mock FHIR bundle.

Demo interaction: press **Simulate new data** and visibly show the workflow stages: normalize -> baseline -> deviation -> context needed -> evidence summary.

## ElevenLabs integration

Use ElevenLabs as a consented **structured check-in assistant**, not a medical chatbot.

### Patient script

> "Your care team's monitoring program noticed a change in recent measurements. This is not a diagnosis or emergency assessment. May I ask a few quick questions to provide your care team context?"

### Agent constraints

- Ask only approved, short, structured questions.
- Never name a suspected condition.
- Never interpret measurements clinically.
- Never offer treatment advice.
- Offer a clear emergency-safety statement in the UI: patients should follow their existing emergency instructions for urgent symptoms.

### Tools

- `get_checkin_questions`: Render API returns the allowed question set based on missing context.
- `record_checkin_response`: drafts structured answers plus the patient's own optional context note in the portal. The patient verifies the draft and submits it with consent and the ElevenLabs conversation ID.
- The portal then reruns the evidence summary and records an auditable check-in event; the voice tool never saves a medical record or escalates automatically.

The demo's best live moment: after the patient says they had no recent exercise and reports worsening fatigue, the portal refreshes the evidence summary to include those facts. It does not change to a diagnosis.

## Provider portal UX

### 1. Overview

- A small set of review items, not a wall of alerts.
- Monitoring coverage: data freshness, consent, and missing-source indicators.
- A visible "context explained" section for simulated events that did not require a review item.

### 2. Evidence workspace (the primary demo screen)

- One synchronized timeline: wearable physiology, CGM, home vitals, sleep/activity, medication events, and check-ins.
- Toggle: `All data` / `Why flagged` / `Context`.
- Evidence panel: measured baseline deviations, durations, data source, and patient responses.
- Clear label: `Statistical review trigger - provider review suggested`.

### 3. Patient check-in state

- "Context missing" indicator.
- Button to start the brief ElevenLabs web voice session.
- Consent screen and safe-use notice.

### 4. Handoff

- A clinician may acknowledge, message patient, request a non-urgent follow-up, or create a mock EHR handoff.
- Show mock FHIR `Observation`, `Communication`, and `Task` resources.
- Every action writes an audit-log row.

### 5. Patient view

- Keep it minimal: connected-device status, consent choices, check-in prompt, and emergency-disclaimer text.
- Do not expose clinician ranking, conclusions, or diagnosis-like language.

## Privacy and HIPAA-oriented implementation

Do not state that the hackathon prototype is "HIPAA compliant." State:

> "The prototype is built with HIPAA-aligned controls and uses synthetic, de-identified demo data. A production deployment would require a formal risk analysis, organizational policies, and Business Associate Agreements with each vendor that creates, receives, maintains, or transmits ePHI."

Implement and visibly demonstrate:

- Synthetic patient records only; never use the team's personal health report or actual identifying health data.
- Explicit patient consent per data source and an option to revoke connection.
- Authenticated role-based access: patient, nurse, provider, administrator.
- Least-privilege data display: provider view contains only data needed for the review workflow.
- Encryption in transit (HTTPS/TLS) and at rest in the production architecture.
- Signed inbound webhooks; validate third-party signatures before accepting a check-in result.
- Secrets in environment variables, never in the client or Git repository.
- Immutable audit events for record view, analysis run, check-in, and provider action.
- Data retention/deletion policy placeholder and patient access/export placeholder.

HIPAA's Security Rule includes access control, audit controls, authentication, integrity protections, and transmission security. Production cloud vendors that create, receive, maintain, or transmit ePHI typically require a BAA.

## Demo dataset

Use synthetic/de-identified patients with three scenarios:

1. **Context-explained fluctuation**
   - Heart rate and glucose rise after a recorded workout/meal.
   - The system records the context and does not create a review item.

2. **Ambiguous coordinated deviation**
   - RHR rises, HRV falls, respiratory rate rises, sleep worsens, and glucose variability rises over 36 hours.
   - The system requests context through ElevenLabs.

3. **Evidence summary**
   - The patient reports no unusual activity and reports worsening fatigue.
   - The provider sees a source-linked statistical summary for review.

## Example review item

> **Statistical review trigger - provider review suggested**
> Resting heart rate was 14% above this patient's baseline for 36 hours. HRV was 24% below baseline, respiratory rate rose for two nights, and glucose variability increased. No recent exercise was reported. The patient reported worsening fatigue during the check-in. Measurements and timestamps are available in the evidence timeline.

## Hackathon build scope

### Must build

- One polished provider portal.
- Synthetic data simulator with at least the three scenarios above.
- Baseline/deviation logic that visibly runs.
- A real Render Workflow task chain.
- One real ElevenLabs web voice check-in or a reliable text fallback.
- Dynamic evidence summary update after the check-in.
- Consent, role, audit-log, and mock FHIR screens.
- A 2-3 minute demo video and public code repository, as required by Devpost.

### Do not attempt in 24 hours

- Live WHOOP, Apple Health, Dexcom, EHR, or hospital authentication integrations.
- Real patients or protected health information.
- Medical diagnosis, clinical risk prediction, treatment logic, or emergency dispatch.
- A claim of HIPAA compliance or clinical validation.

## Demo sequence (about 2 minutes)

1. State the provider-data-fragmentation problem.
2. Open a patient timeline and show raw simulated data across sources.
3. Click `Simulate new data` and show Render Workflow stages.
4. Open the resulting statistical evidence object and show the exact deviations from baseline.
5. Show `Context missing` and launch the ElevenLabs check-in.
6. Answer: no unusual exercise, worsening fatigue.
7. Show the rebuilt evidence summary with those answers and the source timestamps.
8. Open the mock FHIR handoff and audit log.
9. Close with: "The platform does not diagnose. It reduces data fragmentation and gives the provider an auditable statistical summary for review."

## Submission language

### Project description

> A provider-facing remote-monitoring intelligence platform that converts fragmented wearable, CGM, home-vital, medication, and patient-reported data into one patient-specific statistical evidence summary. It identifies persistent coordinated deviations from an individual's baseline, gathers missing context through a consented check-in, and produces an auditable provider-review item with a mock EHR handoff. The prototype uses synthetic data and is decision support only; it does not diagnose conditions or recommend treatment.

### Technology list

- Frontend: provider portal and patient check-in UI
- Backend API: normalized synthetic event store and evidence objects
- Render Workflows: ingest, baseline, deviation analysis, context request, evidence compilation
- ElevenLabs: consented structured patient voice check-in and client-tool draft
- Mock FHIR: Observation, Communication, Task
- Security demonstration: consent, roles, audit events, signed webhooks, secret-based configuration

## Important event rule

Devpost requires the core project code to be created during the hackathon. Treat this document and prior design work as planning; rebuild the actual submitted implementation during the event.
