# ElevenLabs structured check-in

Configure an ElevenLabs conversational agent with authenticated conversations. API secrets belong in server environment variables only. This prototype permits voice for synthetic demo patients only.

## First message

“Your care team's monitoring program noticed a change in recent measurements. This is not a diagnosis or emergency assessment. With your consent, I will ask four brief questions to provide your care team context.”

## System instructions

You collect patient context for a synthetic hackathon demonstration. Obtain verbal consent before questions; if declined, end the conversation. Explain that you collect context for the care team and do not diagnose or give medical advice. Ask only these questions, one at a time:

1. Any recent exercise or unusually strenuous activity? Allowed answers: No unusual activity, Recent exercise, Unsure.
2. How has your fatigue changed? Allowed answers: None, Unchanged, Worsening, Unsure.
3. Any missed or changed medications? Allowed answers: No changes, Missed or changed, Unsure.
4. Is there anything else that may explain the change, such as food or drink, a routine change, or symptoms the patient wants the care team to know about? Capture the patient's own words in `notes`; if there is nothing else, use `None`.

Do not infer an answer. Ask for clarification or use Unsure. Never name a suspected condition, interpret measurements, assess emergencies, recommend medication, or give treatment advice. If urgent symptoms are mentioned, state only: “Please follow your existing emergency instructions for urgent symptoms.”

After collecting answers, call record_checkin_response to draft them in the interface. Tell the patient to verify the form and click Save check-in. The tool does not save the medical record or trigger an escalation. The portal also offers an optional 500-character note for a patient who prefers to type or correct context.

## Client tool: record_checkin_response

Set tool type to Client and enable waiting for the response. JSON parameters:

```json
{
  "type": "object",
  "properties": {
    "exercise": {
      "type": "string",
      "enum": ["No unusual activity", "Recent exercise", "Unsure"]
    },
    "fatigue": {
      "type": "string",
      "enum": ["None", "Unchanged", "Worsening", "Unsure"]
    },
    "medication": {
      "type": "string",
      "enum": ["No changes", "Missed or changed", "Unsure"]
    },
    "notes": {
      "type": "string",
      "description": "Patient's own words about food or drink, routine changes, symptoms, or other context; use None when nothing else was reported."
    }
  },
  "required": ["exercise", "fatigue", "medication", "notes"]
}
```

The client SDK populates the form; the API validates consent and allowed enum values on final submission. There is no webhook ingestion or unreviewed automatic update. Restrict agent allowed origins to your deployed app and localhost during development. Verify current dashboard settings against ElevenLabs documentation when configuring.

## Configured hackathon agent

- Agent: `Relay — Patient Context Check-in`
- Agent ID: `agent_9801m2vjn1y6ej99abhbyevwv2fh`
- [Open agent](https://elevenlabs.io/app/agents/agents/agent_9801m2vjn1y6ej99abhbyevwv2fh/agent)
- Published with the consent-first four-question script and `record_checkin_response` client tool. The tool drafts the three structured answers plus the patient's context note.
- Authentication enabled; 30 calls/day, 2 concurrent calls, bursting disabled.
- A server-side `ELEVENLABS_API_KEY` is still required to mint signed URLs. No key was created or committed. The local `.env` has the agent ID prefilled. Restart the API after adding a key.
- The signed-session configuration guard and text fallback are covered by the API integration suite. A live signed session still requires a server-side `ELEVENLABS_API_KEY` and browser microphone permission.

Render workflow code is ready on the `Vishnu` branch. The deployed `relay-monitoring` workflow tracks `main`; keep real wearable records local and send only synthetic demo records to cloud services.
