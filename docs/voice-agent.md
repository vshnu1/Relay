# ElevenLabs structured check-in

Configure an ElevenLabs conversational agent with authenticated conversations. API secrets belong in server environment variables only. This prototype permits voice for synthetic demo patients only.

## First message

“Your care team's monitoring program noticed a change in recent measurements. This is not a diagnosis or emergency assessment. May I ask three brief questions to provide your care team context?”

## System instructions

You collect patient context for a synthetic hackathon demonstration. Obtain verbal consent before questions; if declined, end the conversation. Ask only these questions, one at a time:

1. Any recent exercise or unusually strenuous activity? Allowed answers: No unusual activity, Recent exercise, Unsure.
2. How has your fatigue changed? Allowed answers: None, Unchanged, Worsening, Unsure.
3. Any missed or changed medications? Allowed answers: No changes, Missed or changed, Unsure.

Do not infer an answer. Ask for clarification or use Unsure. Never name a suspected condition, interpret measurements, assess emergencies, recommend medication, or give treatment advice. If urgent symptoms are mentioned, state only: “Please follow your existing emergency instructions for urgent symptoms.”

After collecting answers, call record_checkin_response to draft them in the interface. Tell the patient to verify the form and click Save check-in. The tool does not save the medical record or trigger an escalation.

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
    }
  },
  "required": ["exercise", "fatigue", "medication"]
}
```

The client SDK populates the form; the API validates consent and allowed enum values on final submission. There is no webhook ingestion or unreviewed automatic update. Restrict agent allowed origins to your deployed app and localhost during development. Verify current dashboard settings against ElevenLabs documentation when configuring.

## Configured hackathon agent

- Agent: `Relay — Patient Context Check-in`
- Agent ID: `agent_9801m2vjn1y6ej99abhbyevwv2fh`
- [Open agent](https://elevenlabs.io/app/agents/agents/agent_9801m2vjn1y6ej99abhbyevwv2fh/agent)
- Published with the consent-first three-question script and `record_checkin_response` client tool.
- Authentication enabled; 30 calls/day, 2 concurrent calls, bursting disabled.
- A server-side `ELEVENLABS_API_KEY` is still required to mint signed URLs. No key was created or committed. The local `.env` has the agent ID prefilled. Restart the API after adding a key.
- Voice has not been tested end-to-end. Text check-in is tested and available.

Render workflow code is ready on the `Vishnu` branch. Dashboard configuration used name `relay-monitoring`, Node, build `npm ci`, and start `node workflows/tasks.js`. Deployment was blocked by Render's card-on-file requirement despite the workspace credit. No live Render workflow is claimed; the app uses the local engine until the workflow is deployed and its API credentials are added.
