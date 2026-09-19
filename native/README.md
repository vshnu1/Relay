# Relay patient app (iOS)

The patient side of Recovery watch as a real iOS app: an installable bundle with
its own icon, splash, bottom tab bar, haptics and microphone permission. The whole
patient journey runs inside it, including the ElevenLabs voice check-in, and it
has been driven end to end on the iPhone 17 Pro simulator: access code →
discharge code → home → voice check-in with a two-way transcript.

## Run it

Three commands, from a clean checkout. Xcode and a booted simulator are the only
prerequisites; there is no CocoaPods step (Capacitor 8 uses Swift Package
Manager).

```sh
npm ci && npm run build && npm start   # in the repo root: the Relay API on :3001
```

```sh
cd native && npm install && npm run ios
```

`npm run ios` copies `www/`, builds for the simulator, installs and launches.
`RELAY_SIM="iPhone 17e" npm run ios` picks a different device.

Sign in with the patient access code from `.env` (`PATIENT_ACCESS_CODE`), then a
discharge code from `docs/PATIENT.md` (`BAY-2741` is Maya Okafor, the runbook's
patient). The Return key submits both code fields.

### On a real iPhone

The simulator shares the Mac's `localhost`; a phone does not.

```sh
npm run host 192.168.1.20:3001   # your Mac's address on the same Wi-Fi
npm run ios
```

`Info.plist` allows plain HTTP to local addresses only (`NSAllowsLocalNetworking`),
so anything off the LAN needs `https`. Opening the project in Xcode
(`npm run open`) and picking your device handles signing.

## How it works, and why it is built this way

The app loads the Relay web app from the API server rather than bundling a copy.
That is not laziness: the server sets a strict CSP and rejects cross-origin
writes, so a bundled copy at `capacitor://localhost` could read the record but
could not submit a check-in or open a voice session. Served from the origin, the
patient app behaves exactly as it does in a browser — same API, same session,
same ElevenLabs path — and the native layer only adds what a browser cannot.

`www/index.html` is the fallback shown when the server cannot be reached.

### The native layer

`www/chrome.css` and `www/chrome.js` are injected into the page as a single
`WKUserScript` by `RelayViewController` in `ios/App/App/AppDelegate.swift`.
**Nothing under `src/` is modified.** The frontend belongs to another owner
(see `AGENTS.md`), and a tab bar over the home indicator is a native concern
that should not land in `recovery.css`, where it would also change every desktop
browser. Everything is scoped to `html.relay-native`, a class only this shell
sets, so the same server serves the plain web app to everyone else unchanged.

`chrome.css` is the whole visual revamp — the brief was to make the app read as
an iPhone app, not a website on a phone, without a rebrand. It uses the
product's own tokens (`--pine`, `--sage`, `--amber-tint`, `--serif`) and:

- lays every screen out in one column with 16px gutters; surfaces are filled
  cards with soft shadows instead of 1px-bordered boxes;
- makes controls 56pt, the primary action pine-filled, and gives everything
  tappable press feedback (`:active` scale);
- centres the two sign-in screens around one field and one button, with the
  discharge code shown monospaced as `ABC-1234`;
- turns the home alert into the hero: warm card, amber edge, serif headline,
  thumb-sized Check in; stacks the reading tiles as status chip → title → number;
- on the check-in, stacks the mode choice as two big rows, keeps the Start button
  **sticky above the tab bar** while the card scrolls, shows the live call as a
  sage panel with a pulsing indicator and the question in serif, renders the
  transcript as chat bubbles, and pins the text composer above the bar like a
  messaging app;
- moves the responsive sidebar to a translucent bottom tab bar (icon over label,
  badge on the icon, sign-out as the last item);
- hides the demo role switcher — on a phone the app is one patient signed in
  with their own code.

`chrome.js` handles behaviour the page cannot know it needs:

- amends the page's viewport tag with `viewport-fit=cover` so safe-area insets
  work (adding a second `<meta>` lays the page out at the wrong width) and locks
  page scale, because the WebView otherwise zooms into a tapped control and stays
  there;
- **haptics** through the injected Capacitor bridge (`@capacitor/haptics`):
  medium on primary actions, light on tabs, options and rows; guarded so a plain
  browser never notices;
- keyboard hints on the two code fields (`enterkeyhint="go"`, no autocorrect),
  which the page does not set because a desktop has no use for them;
- resets the scroll when a top-level screen is swapped in by state (gate →
  discharge → home happen with no hash change, while the keyboard's scroll
  offset is still in effect, which otherwise opens the next screen with its
  heading under the status bar), and dismisses the keyboard on route changes;
- opens on `#/patient` however the app was last left.

Traps worth knowing if you edit these. At phone widths `.rx-side` is a CSS
**grid**, so flex properties are inert unless `display: flex` is restated. At
`.atDocumentStart` `document.documentElement` can still be null. `backdrop-filter`
on the tab bar makes it the containing block for any `position: fixed`
descendant — nothing inside it is fixed today, keep it so. The base
`.rx-p-live-controls` wraps, which in a column sends the 100%-basis question into
a second column; it is set to `nowrap` here. And `SceneDelegate.swift`, not
`Main.storyboard`, decides the root view controller in Capacitor 8.

### Assets

`npm run icons` redraws `AppIcon` and the splash from the mark in
`public/favicon.svg` (`scripts/make-icons.py`, needs Pillow).

## What is and is not real

- **Real:** a signed app bundle, native launch, haptic feedback, microphone
  permission prompt backed by `NSMicrophoneUsageDescription`, and a live
  two-way ElevenLabs conversation with this patient's readings as dynamic
  variables.
- **Not yet:** HealthKit. "Your data" still asks for an Apple Health
  `export.zip`, parsed in the WebView exactly as on the web. A Capacitor health
  plugin would replace that picker with background delivery and change nothing
  downstream — `model/contract.js` already treats readings as a feed, and the HK
  identifiers are mapped in `model/healthImport.js`.
- **Not yet:** push notifications. `model/schedule.js` computes `checkinDue`
  already, but nothing reaches the patient unless they open the app.
- **Not offline.** With the server down the app shows `www/index.html`.
- Page zoom is disabled in the shell (`user-scalable=no`); the web app keeps
  pinch zoom and iOS Zoom still works. Dynamic Type support is the accessible
  fix and is not done.

### What would make it easier still, and needs the frontend owner

The shell can restyle and re-behave every screen but cannot change flow or copy.
Three changes in `src/recovery` would remove the most friction on a phone:

1. One sign-in step for a phone: remember the access-code gate per device, so a
   returning patient only enters their discharge code (or nothing, behind the
   device passcode).
2. Default the check-in to voice when the server reports `voice: true`; text
   stays one tap away.
3. Move sign-out into "Your data" so the tab bar can be five items.

## Why this is a separate npm project

`package.json` in the repo root is a hot file every teammate edits, and
`AGENTS.md` asks for dependency changes to land alone. Capacitor lives here
instead, with its own lockfile, so this app adds no conflict to anyone's branch.
