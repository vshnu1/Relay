https://chatgpt.com/s/cx_6aadd3b42e2c8191a438c42558c7e200

The idea
Relay helps care teams understand what is happening to patients recovering at home.
Patients already generate health data through:
Apple Watch or WHOOP
Continuous glucose monitors
Pulse oximeters
Medication records
Sleep and activity tracking
Symptom check-ins
The problem is that this information lives in separate places. Clinicians cannot constantly review every measurement from every patient.
Relay combines the information and answers:
What changed, how unusual is it for this patient, and what information does the clinician need to review?

Who it is for
For the hackathon, we focus on:
Patients during the first 14 days after major abdominal surgery.
These patients may be stable enough to recover at home but still require monitoring for unexpected changes.
We are using one specific scenario to make the demonstration believable. The larger product could eventually support other recovery and chronic-care programs.

What Relay does
Relay:
Receives data from simulated health devices.
Creates a baseline for the individual patient.
Looks for several measurements changing together.
Determines whether the pattern is persistent or temporary.
Identifies missing information.
Uses ElevenLabs to ask the patient focused questions.
Reanalyzes the case with the patient’s answers.
Creates one evidence packet for the clinician.
Produces a mock EHR/FHIR handoff.
Relay does not diagnose the patient or recommend treatment.

Example
Maya is recovering at home six days after surgery.
Relay notices:
Resting heart rate is rising.
HRV is falling.
Respiratory rate is elevated.
Sleep is becoming fragmented.
Glucose variability is increasing.
The individual readings are not enough to explain what is happening.
Relay marks the case:
Context needed
An ElevenLabs voice assistant asks Maya a short set of questions:
Did you exercise recently?
Has your pain worsened?
Have you missed any medication?
Are you experiencing fever, vomiting, fatigue, or shortness of breath?
Maya reports worsening fatigue and shortness of breath with no unusual exercise.
The system runs the analysis again and updates the case:
Review recommended
Multiple measurements have changed together for 30 hours. Recent activity does not explain the pattern, and the patient reports new shortness of breath.
The clinician can then inspect every measurement, timestamp, and patient answer supporting that statement.

The complete pipeline
Wearable + CGM + pulse-oximeter data
                  ↓
           FastAPI backend
                  ↓
          Render Postgres
                  ↓
          Render Workflow
                  ↓
     Normalize and align the data
                  ↓
       Calculate baseline features
                  ↓
          Run the ML model
                  ↓
         Missing context found
                  ↓
      ElevenLabs voice check-in
                  ↓
     Structured answers sent back
                  ↓
      Render Workflow runs again
                  ↓
     Clinician evidence packet
                  ↓
         Mock EHR/FHIR export

How Render is used
Render is a real part of the processing pipeline, not merely the website host.
A Render Workflow performs these steps:
Validate incoming readings.
Normalize units and timestamps.
Create six-hour analysis windows.
Calculate changes from the patient’s baseline.
Run the ML model.
Apply data-quality and persistence rules.
Generate the evidence packet.
Decide whether patient context is needed.
After the ElevenLabs check-in, another workflow run updates the analysis.
This qualifies the project for the Render prize, which specifically requires Render Workflows.

How ElevenLabs is used
ElevenLabs powers a short browser-based patient conversation.
It is used to collect information that devices cannot provide, such as:
Worsening pain
Shortness of breath
Nausea or vomiting
Medication adherence
Unusual exercise
New fatigue
The conversation produces structured answers:
{
  "unusual_exercise": false,
  "shortness_of_breath": true,
  "pain_change": "worse",
  "medication_missed": false
}
Those answers are sent to Relay and become part of the next ML and rules-based analysis.

The ML model
Use an Isolation Forest anomaly-detection model.
The model examines:
Resting heart-rate change
HRV change
Respiratory-rate change
SpO₂ readings
Glucose variability
Sleep disruption
Activity level
How long changes persist
Missing or unreliable data
It answers:
Is this combination unusual compared with this patient’s modeled baseline?
It does not predict a disease or assign a probability of deterioration.
The interface explains the output using understandable evidence:
Respiratory rate is 12% above baseline for two nights. HRV is 24% below baseline. Glucose variability has increased. These changes occurred during the same period.

The four application states
State
Meaning
Monitoring
Data is arriving and no additional context is currently required.
Context needed
The pattern is unusual, but important information is missing.
Review recommended
An evidence packet is ready for a clinician to inspect.
Insufficient data
There is not enough reliable information to interpret the pattern.

Avoid labels such as “safe,” “healthy,” “emergency,” or “sepsis detected.”

The four screens
1. Patient overview
Shows:
Three synthetic patients
Current status
Data freshness
Why each patient is in that state
2. Evidence timeline
Shows:
Health measurements on one synchronized timeline
The patient’s baseline
When the change began
Medication, activity, and symptom events
Missing data
The ML result and supporting evidence
This is the main screen.
3. Voice check-in
Shows:
Patient consent
Live ElevenLabs conversation
Questions and structured answers
Analysis before and after the conversation
4. Clinical handoff
Shows:
Clinician-readable summary
Supporting data
Mock FHIR payload
Audit history

Four-person team split
Person
Responsibility
1. Frontend
Dashboard, evidence timeline, animations, and visual polish
2. Backend/Render
FastAPI, Postgres, Render Workflows, deployment, and FHIR export
3. ML/Data
Synthetic patients, feature engineering, model, explanations, and tests
4. Voice/Demo
ElevenLabs, webhooks, full integration testing, pitch, and demo video

Person 2 should act as the integration lead and control shared data contracts.

Git and AI workflow
Use one repository with four worktrees:
feature/web
feature/api-render
feature/ml-data
feature/voice-demo
Repository structure:
apps/
  web/
  api/

packages/
  contracts/
  ml/
  voice/

data/
infra/
docs/
Before separating:
Agree on the API structure.
Create shared data types.
Create two example JSON responses.
Make sure the frontend can run from those fixtures.
Give each Claude session:
The locked project brief
Its assigned directory
Exact deliverables
Shared API contracts
Tests or acceptance criteria
A rule not to edit other directories
Merge small changes every 60–90 minutes.

What to prioritize
The project is complete when this works:
Data enters the backend.
A real Render Workflow processes it.
A real ML model scores it.
The frontend explains the result.
A real ElevenLabs conversation collects context.
The response reaches the backend.
Another workflow updates the case.
The clinician can inspect and export the evidence.
Everything else is optional.

Do not spend time building
Real WHOOP, Apple, Dexcom, or Libre integrations
A mobile application
Telephone calling
Real hospital EHR access
A general medical chatbot
Multiple clinical conditions
Production authentication
Deep learning
More than four polished screens
Use synthetic data and simulated device connectors.

Final pitch
Hospitals face a difficult transition: some patients no longer need an inpatient bed, but they still need meaningful observation as they recover at home. Relay combines fragmented wearable, glucose, oxygen, medication, and symptom data into one patient-specific evidence story. It identifies unusual changes relative to the patient’s baseline and uses an ElevenLabs voice check-in to gather information that devices cannot provide. Render Workflows then converts that combined evidence into a clear, traceable case for clinical review.
Short version
Relay makes recovery between visits visible. It combines fragmented home-health data, detects unusual changes, gathers missing context through voice, and gives clinicians one explainable evidence packet.

