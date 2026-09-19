# Clinician voice summary

The clinician patient overview has a **Listen to summary** action. Selecting it requests a fresh Relay score, builds a deterministic briefing from the same recovery-watch signals shown on screen, and asks the API server to synthesize that text with the ElevenLabs voice configured on the conversational agent. The page also exposes the exact text that was spoken and labels whether the score was fresh, previously available, or unavailable.

The briefing includes the recovery-watch status, persistent counted signals with current values and duration, the Relay application state and contributors when available, and a few structured check-in answers. It excludes names, record identifiers, and free-text notes. If model scoring is unavailable, it says so and falls back to the recovery-watch readings. It does not diagnose or recommend treatment.

The API endpoint is clinician-role gated and accepts only bounded text explicitly marked as synthetic demo data. It returns audio without persisting the audio or summary text in the app. The Render blueprint enables the endpoint for this synthetic-only demo; set `ELEVENLABS_DEMO_SUMMARY_ENABLED=false` before loading any real patient records. ElevenLabs receives the summary text when the feature is used, so this prototype must not send real patient information without appropriate vendor agreements and privacy review.

The service uses `ELEVENLABS_VOICE_ID` when set, otherwise it reads the voice ID from `ELEVENLABS_AGENT_ID`. The ElevenLabs API key remains server-side.
