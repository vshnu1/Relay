# Patient view

The patient side of the recovery app (`src/recovery/patient/`), end to end. Every
patient is synthetic; nothing here leaves the browser except the email the patient
chooses to send.

## Flow

1. **Sign in** (`#/patient`): choose the hospital, enter the discharge code printed on
   the discharge letter, agree to share. Codes are seeded per demo patient in
   `model/simulatedSource.js`. Session only. Demo codes:

   | Code     | Patient          | Hospital                           |
   | -------- | ---------------- | ---------------------------------- |
   | BAY-2741 | Maya Okafor      | Bayfront Health — Respiratory Unit |
   | TGH-5580 | Daniel Reyes     | Tampa General — Cardiology         |
   | MMC-1193 | Priya Nair       | Mercy Medical — General Surgery    |
   | LKR-8027 | Tom Lindqvist    | Lakeside Regional — Pulmonary      |
   | SVH-3364 | Aisha Rahman     | St. Vincent's — Cardiology         |
   | MMC-6608 | Samuel Osei      | Mercy Medical — General Surgery    |
   | TGH-9915 | George Whitfield | Tampa General — Cardiology         |
   | BAY-4470 | Lena Fischer     | Bayfront Health — Respiratory Unit |

   The twelve patients added on `main` get stable codes from their ids:
   TAM-7051 Marcus Webb, MER-6489 Nadia Haq, LAK-2832 Yusuf Demir, BAY-7547 Ingrid
   Larsen, LAK-6727 Oliver Grant, BAY-3991 Beatrice Cole, TAM-5838 Hassan Ali,
   MER-9855 Clara Moreau, LAK-1482 Arthur Bennett, LAK-9985 Mei Tanaka, TAM-6507
   Rosa Iglesias, TAM-1604 Amara Nwosu.

2. **Home**: what the patient needs the moment the app opens. A header with the
   condition and hospital, a greeting, and the day of recovery with a progress bar
   and the device sync line. Then one banner for the day's state: amber "Something
   unusual was found in your readings" with **See what changed** and **Check in now**
   when the readings or the model call for an off-schedule check-in (or the care
   team asked, or a report is recommended); a calm card for a routine check-in;
   a quiet line when nothing is needed. Below it, two lanes: **Your readings**
   (one tile per counted signal with today's value, the usual, a Changed/Usual chip
   and a 14-day sparkline, then the model's line with a score button) and **From
   your hospital** (discharge date and clinician, the doctor's notes, prescriptions,
   the next follow-up, and a link to messages). The model scores the patient's own
   readings when the home opens. The discharge (notes, prescriptions, follow-up) is
   seeded per pathway for the demo; messages, journal entries and reports happen live.
   Demo path: sign in with `BAY-2741`, read the banner, **Check in now**, talk it
   through, confirm the report, then open the clinician view.
3. **Check-in** (`#/patient/checkin`): one voice conversation. Relay opens by saying
   why it is checking in (daily for the first week at home, every other day after,
   `SCHEDULE` in `model/profiles.js`; or because the readings moved; or because the
   care team asked), then talks through the profile's questions. With
   `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` on the server the ElevenLabs agent
   runs it: it reads the readings and the model's result through a client tool,
   records the answers, and returns one recommendation. Without the key the browser
   speaks and listens itself. Tapping an answer always works. When every question is
   answered the app submits, re-scores with the model, and offers **What this
   means** (`#/patient/insight`).
   Check-in alerts: `checkinDue` also fires off-schedule when the rules see a
   persistent pattern or the model marks the recent windows anomalous
   (`reason: "readings"`); the sidebar badge and the home alert show it at once.
4. **Readings** (`#/patient/readings`): one chart at a time, same chart as the doctor
   view, patient wording, plus a form to enter temperature, weight or pain by hand.
   Links to **Record something** (`#/patient/journal`, timestamped notes of anything
   unusual) and to what is watched.
5. **Care team** (`#/patient/care`): appointments, two-way messages, and **Send a
   report**: a confirmation sheet, a preview, then a pre-filled email draft. Nothing
   is sent automatically; the app only records that the patient chose to send.
6. **Your data** (`#/patient/connect`): connect a wearable through an "Allow Relay to
   read…" sheet (simulated; readings then flow from the stream), pause sharing, and
   import the iPhone Health app's `export.zip` or `export.xml`. The import is parsed in
   a Web Worker with the browser's own `DecompressionStream`; nothing is uploaded.
   Readings before admission become the patient's "usual".

## The model in the patient view

`POST /api/ml/score` spawns the Python model for the readings the browser sends
(`model/mlClient.js` maps app signals to the model's metrics). The patient can score
from Home or the insight screen; a check-in re-scores with the answers as context.
The model's state leads the insight, the notifications and the report. Requires
`RELAY_ML_ENABLED=true` on the server.

## Questions and the ML model

Every question in `QUESTIONS` carries `ml` (the field name in
`ml/relay_ml/programs.py`) and `toModel` (option to model value). `toModelContext()`
turns a check-in into the `context` object the ML CLI scores, and `buildReport()`
includes it. Each watch profile names its ML program (`ml`) and, where relevant, the
adherence field its medicine question also feeds.

## Persistence and the shared record

Everything either side enters is one event with a client id: imports, own readings,
journal entries, device connections, check-ins, notes, the model's result and sent
reports from the patient; messages, discharge notes, appointments, check-in requests,
acknowledgements and sharing changes from the clinician. The store applies an event
locally at once, appends it to this browser's log (`model/persist.js`) and sends it to
`POST /api/recovery/events`; `model/sync.js` polls `GET /api/recovery/events?after=`
every three seconds so the other view, on any device, sees it within seconds. The
server keeps the log append-only under `DATA_DIR` (`recovery-events.jsonl`, never in
git) and filters the patient role to the signed-in patient's record. Replays skip ids
already applied, so nothing lands twice. Without the API the app keeps working from
this browser's log; the demo bar says "Offline: this browser only".

A report is sent inside Relay: the patient confirms, the text travels as an event,
and the clinician reads it under **Patient activity** on the patient's page. An email
draft remains available as an extra.

## Limits

- The discharge code is demo scaffolding, not authentication. Main's shared role code
  is checked by the server first when configured; the discharge code then picks the
  profile.
- Discharge notes, medicines, messages and appointments are entered by the care team
  in the clinician view during the demo; nothing under those headings is pre-written.
- A Health import with "use only my own data" replaces the example readings and stops
  the simulated stream for that patient, so charts and the model run on real data.
- Wearable "connections" are simulated; a real one implements the source contract.
- Speech uses the browser's services; quality varies by browser.
- Email goes through the device's mail app via `mailto:`; no server sends anything.
