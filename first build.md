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
