# Patient view

The patient side of the recovery app (`src/recovery/patient/`), end to end. Every
patient is synthetic; nothing here leaves the browser except the email the patient
chooses to send.

## Flow

1. **Sign in** (`#/patient`): choose the hospital, enter the discharge code printed on
   the discharge letter, agree to share. Codes are seeded per demo patient in
   `model/simulatedSource.js` (the sign-in screen can reveal them). Session only.
2. **Home**: day of recovery, notifications (check-in due, report recommended,
   appointment soon, unread nurse message, device to connect), quick actions, today's
   readings in plain words, device status.
3. **Me** (`#/patient/profile`): discharge details, the doctor's notes, medicines, what
   is watched, links to data and journal, sign out.
4. **Your data** (`#/patient/connect`): connect a wearable through an "Allow Relay to
   read…" sheet (simulated; readings then flow from the stream), pause sharing, and
   import the iPhone Health app's `export.zip` or `export.xml`. The import is parsed in
   a Web Worker with the browser's own `DecompressionStream`; nothing is uploaded.
   Readings before admission become the patient's "usual".
5. **Readings** (`#/patient/readings`): one chart at a time, same chart as the doctor
   view, patient wording, plus a form to enter temperature, weight or pain by hand.
6. **Check-in** (`#/patient/checkin`): the profile's questions, one per screen, with
   optional read-aloud. Due daily for the first week at home, then every other day
   (`SCHEDULE` in `model/profiles.js`), and whenever the care team or the readings ask.
7. **Assistant** (`#/patient/assistant`): the same questions as a chat; tap, type or
   speak (browser speech recognition and synthesis). Scripted, not a chatbot. ElevenLabs
   can replace the browser voice when the server key is configured.
8. **Record something** (`#/patient/journal`): timestamped notes of anything unusual.
9. **What this means** (`#/patient/insight`): the plain-words result of the last
   check-in against the readings, with one action. Never a diagnosis.
10. **Care team** (`#/patient/care`): appointments, nurse messages, and **Send a report**:
    a confirmation sheet, a preview, then a pre-filled email draft. Nothing is sent
    automatically; the app only records that the patient chose to send.

## Questions and the ML model

Every question in `QUESTIONS` carries `ml` (the field name in
`ml/vesper_ml/programs.py`) and `toModel` (option to model value). `toModelContext()`
turns a check-in into the `context` object the ML CLI scores, and `buildReport()`
includes it. Each watch profile names its ML program (`ml`) and, where relevant, the
adherence field its medicine question also feeds.

## Persistence

Patient-entered facts (imports, own readings, journal, device connections, check-ins,
sent reports, read messages) are an event log in `localStorage` (`model/persist.js`),
replayed onto the next snapshot by the store. Clear it with `clearLog()` or by
clearing site data.

## Limits

- The discharge code is demo scaffolding, not authentication.
- Wearable "connections" are simulated; a real one implements the source contract.
- Speech uses the browser's services; quality varies by browser.
- Email goes through the device's mail app via `mailto:`; no server sends anything.
