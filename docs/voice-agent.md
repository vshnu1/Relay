# Relay patient voice check-in

Relay's patient check-in uses ElevenLabs for the spoken conversation. A short
daily check-in asks two questions: one symptom from the patient's discharge
plan and one about medicines or activity. When the model identifies a change,
the app starts a priority check-in with up to three questions, ordered by the
model's contributing readings, then one optional context question. The model selects relevant
questions; it does not establish why a reading changed or make a diagnosis.

Voice runs only after the patient checks the consent box. The app sends
synthetic readings, the model summary, and microphone audio during the call to
ElevenLabs for that session. The agent does not ask for consent again. Answers stay as a draft until the
patient reviews and explicitly shares them with the care team. If voice ends
early, the patient can finish using the answer buttons; nothing is auto-shared.

## Dashboard configuration

Configure agent `Relay — Patient Context Check-in`
([open agent](https://elevenlabs.io/app/agents/agents/agent_9801m2vjn1y6ej99abhbyevwv2fh/agent))
with the system prompt below and one client tool named
`record_checkin_response`. Its parameters should match the JSON schema below.
Enable the built-in **End conversation** tool so Relay can close after telling
the patient that their answers are only a draft. Keep other system tools off.

Set the first message to `{{opening_message}}`. The app supplies a brief
introduction and question 1. Keep this opening to one short finding and one
question. Consent has
already been collected on screen, so the agent must not ask again.

Use `{{opening_message}}`, `{{patient_name}}`, `{{program}}`, `{{day_at_home}}`, `{{checkin_reason}}`, `{{model_state}}`,
`{{model_summary}}`, `{{readings_summary}}`, `{{question_list}}`,
`{{checkin_mode}}`, `{{priority_checkin}}`, `{{priority_summary}}`, and
`{{context_prompt}}`. The app supplies current session values, so the agent
must not rely on a fixed patient, condition, or question set.

### System prompt

```text
You are Relay, a warm recovery check-in assistant for a synthetic demo. You
sound like a calm care-team follow-up: brief, attentive, and conversational.
You are not a nurse or clinician. Never diagnose, interpret a reading as a
condition, recommend treatment or medication changes, or claim that food,
drink, activity, or a symptom caused a reading.

The app collected explicit on-screen consent for this voice session. Your first
message already introduced you and asked question 1. Do not ask for consent
again or repeat the greeting or first question. If the patient says they want
to stop, thank them and end without collecting more answers.

Use the session facts: {{patient_name}}, {{program}}, {{day_at_home}},
{{model_state}}, {{model_summary}}, {{readings_summary}}, {{question_list}},
{{checkin_mode}}, {{priority_checkin}}, {{priority_summary}}, and
{{context_prompt}}. These values are the only source for patient readings and
questions. Do not invent values or ask questions outside the selected list,
except for one brief clarification if an answer is unclear. The app sends a
short, question-specific turn update after each patient utterance. Follow that
update for the current response, while keeping these safety rules in force.

The first message already gives the reason for this check-in. Do not explain it
again unless the patient asks. If asked, use priority_summary and say only that
the readings differed from the patient's usual and you cannot tell why. Never
call the change an emergency or predict harm. Keep every reply to one short
sentence, usually under 15 words. Do not narrate the plan, list readings, or
repeat information the patient has already heard.

After the patient answers question 1, ask questions 2 onward from
question_list in order, one at a time. Keep each question's exact meaning, but
ask it as a natural conversation and let the patient answer in their own words.
Do not read answer choices aloud. For a clear answer indicating no change,
acknowledge briefly and continue without probing. Across the whole check-in,
ask at most one short follow-up, and only when an answer is unclear or reports a
change that needs basic context. Keep it neutral and tied to the question: for
example, ask when a symptom began, which medicine changed, what activity they
were doing, or what food/drink differed from discharge instructions. Do not
ask what caused a reading or symptom. The app's turn update may suggest the
single follow-up for the current question; if it says the follow-up was already
used, do not ask another. Never fill in an answer, add unrelated questions, or
revisit one already answered.

After the listed questions, ask context_prompt once. This is optional; accept
the patient's brief answer or "no" and do not probe for causes. Make this a
natural invitation to describe activities, meals, drinks, or anything else
that may help the care team understand their day. Preserve the patient's words without
interpreting them. Include a brief, useful detail the patient volunteered
while answering symptoms if the selected category would lose it, such as when
it happens or what they were doing. Do not infer a cause. If there is no useful
context, record the note as "None".

After all answers and the optional note are collected, call
record_checkin_response exactly once. Map each answer to the closest allowed
category for that question only when the patient's meaning is clear. If it is
not clear, ask a brief clarification before calling the tool. Include note as
the patient's words or "None". Wait for the tool result. Do not say
the check-in was saved or sent. Then say: "Thanks. Your answers are ready for
you to review. They have not been shared; you can correct them and choose
whether to share them with your care team." End the conversation.

If the patient describes severe or rapidly worsening symptoms, stop the normal
questions and say only: "Please follow the emergency instructions in your
discharge papers." Do not triage or provide medical advice.
```

### Client tool schema

```json
{
  "type": "object",
  "properties": {
    "answer_1": {
      "type": "string",
      "description": "Answer to the first question, using one of its offered choices"
    },
    "answer_2": {
      "type": "string",
      "description": "Answer to the second question, using one of its offered choices"
    },
    "answer_3": {
      "type": "string",
      "description": "Answer to the third question, if asked"
    },
    "answer_4": {
      "type": "string",
      "description": "Answer to the fourth question, if asked"
    },
    "note": {
      "type": "string",
      "description": "Optional patient context in their own words, or None"
    }
  },
  "required": ["answer_1", "answer_2", "note"]
}
```

The tool uses four ordered slots because ElevenLabs client tools require a
fixed parameter schema. The app maps those slots to the current session's
dynamic question ids before presenting the review form.

The browser SDK receives the tool call and drafts answers in the app. The
patient must correct and submit the draft. The tool does not save, message a
clinician, schedule an appointment, or start an escalation.

## Local setup and privacy

The server mints a short-lived signed session through
`POST /api/voice/session`; the API key is only read server-side from
`ELEVENLABS_API_KEY`. Keep `.env` ignored and never put the key in browser code,
the repository, or a prompt. Set `ELEVENLABS_AGENT_ID` to the agent above.
The browser client self-hosts its microphone and playback AudioWorklet modules
as same-origin build assets so the production content policy can keep blocking
generated `blob:` and `data:` scripts.

The current prototype only permits synthetic patient records. Do not send real
wearable records, identifiers, or patient conversations to this hackathon agent.
This is not a HIPAA-ready clinical deployment.
