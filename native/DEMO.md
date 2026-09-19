# Filming the patient app on the simulator

Everything below was run today on the iPhone 17 Pro simulator with the build
at `70a75be`. Timings are for a 2–3 minute take that shows the patient side
end to end, voice included.

## Before you press record

```sh
npm start                      # repo root — the API on :3001 (already running)
cd native && npm run ios       # only if the app is not already installed
```

Then, once:

```sh
xcrun simctl status_bar booted override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100
```

That is the clean 9:41 / full-signal / full-battery bar. It is already set on
the booted simulator; it survives relaunches, not reboots.
`xcrun simctl status_bar booted clear` puts it back.

Checks, thirty seconds:

- **Microphone.** Simulator menu → I/O → Audio Input → your Mac's mic. The
  voice check-in listens through it. macOS asks Simulator for mic access the
  first time; say yes.
- **Server.** `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3001/`
  → `200`. If the server dies mid-take the app shows a fallback page; restart
  it and relaunch the app.
- **Fresh launch.** Relaunch from the terminal, not from Safari, or iOS shows a
  "◀ Safari" breadcrumb in the status bar:
  `xcrun simctl terminate booted health.relay.patient; xcrun simctl launch booted health.relay.patient`
- The app signs itself out after **15 minutes** idle. Not a problem for a
  take; do not leave it signed in for an hour and expect it to still be.

To record the simulator itself rather than the screen:

```sh
xcrun simctl io booted recordVideo --codec h264 ~/Desktop/relay-patient.mp4   # Ctrl-C to stop
```

## The take

Codes: the access code is `PATIENT_ACCESS_CODE` in `.env`; the discharge code
is **BAY-2741** (Maya Okafor, Bayfront Health — Respiratory Unit). The Return
key submits both fields.

**0:00 Sign in (20 s).** Patient access → code → Return. Choose *Bayfront
Health, Respiratory Unit*, type `BAY-2741`, tick the consent, *Sign in to my
profile*. Point at the consent sentence: sharing is scoped to this hospital
for 30 days and can be stopped.

**0:20 Home (20 s).** "Good afternoon, Maya", day 9 of 30. The alert card is the
whole story: four readings moved for about 35 hours, and Relay asks before
anyone assumes. Note the device row — Apple Watch and WHOOP, synced — and the
readings tiles under it.

**0:40 Readings (30 s).** Tap *Readings*. The chart is first: breathing while
asleep, last night 16.5 against a usual of 14.2, +16% for three nights. The
grey band is her own usual range, the dashed line is where a change counts.
Tap *Resting heart rate* or *Heart rate when walking* lower down: the chart
comes back up with that signal. Say once: nothing here is a diagnosis; it is a
reason to look.

**1:10 Voice check-in (60 s).** Tap *Check-in* (the badge). Scroll to *Voice
conversation*, tick the ElevenLabs consent, *Start priority voice check-in*.
Allow the microphone. Relay opens by name with the specific change ("your
breathing while asleep has been higher than usual for about 3 days") and asks
the first question. Answer out loud — short answers work: "No", "Yes, a
little", "I walked to the shop". Your words appear in the transcript as you
speak. Two or three exchanges is plenty. Tap *End check-in*.

**2:10 Review and share (20 s).** The review card shows what Relay heard as
structured answers you can correct, an optional note, and a consent box. Tick
it and *Share check-in with my care team*. "Sent to your care team." This is
the point to make: the patient reviews and approves before anything leaves
the phone.

**2:30 Care team (10 s, optional).** Tap *Care team*: Dr. Elena Ruiz, and a
message box. Or tap the device row on Home to show *Your data*: the two
wearables with their toggles, the Health-app import, and Sign out.

## If something goes wrong

- **Voice does not start.** The button says "Preparing…" then nothing: the
  server is up but ElevenLabs is not reachable, or the mic was denied. Switch
  to *Text conversation* — same flow, typed; the demo still lands.
- **"Relay can't reach your care record."** The server is down. `npm start`,
  then relaunch the app.
- **Signed out unexpectedly.** 15 minutes idle. Sign in again; 20 seconds.
- **The record looks used.** Submitting a check-in writes to the shared record
  and the clinician view sees it. Starting one and ending it does not. If you
  submit during a rehearsal and want it gone before the real take, stop the
  server, delete `data/recovery-events.jsonl` and restart it — the roster is
  re-seeded from `simulatedSource.js`; that file only holds what was entered.
- **Need it on a real iPhone instead.** `npm run host <your-mac-ip>:3001`,
  then `npm run ios` with the device selected in Xcode. Same Wi-Fi.
