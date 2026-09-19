# Relay patient app (iOS)

The patient side of Recovery watch as a real iOS app: an installable bundle with
its own icon, splash, tab bar and microphone permission. The whole patient
journey runs inside it, including the ElevenLabs voice check-in.

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

Sign in with the patient access code, then a discharge code from
`docs/PATIENT.md` (`BAY-2741` is Maya Okafor, the runbook's patient).

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
sets.

What the layer does:

- moves the responsive sidebar to a bottom tab bar, icon over label, above the
  home indicator, with sign-out as its last item;
- clears the notch, by amending the page's own viewport tag with
  `viewport-fit=cover` (adding a second `<meta>` instead lays the page out at the
  wrong width);
- hides the demo role switcher — on a phone the app is one patient signed in
  with their own code;
- opens on `#/patient` however the app was last left.

Two traps worth knowing if you edit `chrome.css`. At phone widths `.rx-side` is
a CSS **grid**, so flex properties are inert unless `display: flex` is restated.
And `backdrop-filter` on that bar would make it a containing block for every
`position: fixed` descendant, which silently positions them against the bar
instead of the screen.

`SceneDelegate.swift`, not `Main.storyboard`, decides the root view controller
in Capacitor 8.

### Assets

`npm run icons` redraws `AppIcon` and the splash from the mark in
`public/favicon.svg` (`scripts/make-icons.py`, needs Pillow).

## What is and is not real

- **Real:** a signed app bundle, native launch, microphone permission prompt
  backed by `NSMicrophoneUsageDescription`, and a live ElevenLabs conversation
  with this patient's readings as dynamic variables.
- **Not yet:** HealthKit. "Your data" still asks for an Apple Health
  `export.zip`, parsed in the WebView exactly as on the web. A Capacitor health
  plugin would replace that picker with background delivery and change nothing
  downstream — `model/contract.js` already treats readings as a feed, and the HK
  identifiers are mapped in `model/healthImport.js`.
- **Not yet:** push notifications. `model/schedule.js` computes `checkinDue`
  already, but nothing reaches the patient unless they open the app.
- **Not offline.** With the server down the app shows `www/index.html`.
- Page zoom is disabled in the shell (`user-scalable=no`), because the WebView
  otherwise zooms into a tapped control and stays there, clipping every screen.
  The web app keeps pinch zoom; iOS Zoom still works. Dynamic Type support is
  the accessible fix and is not done.

## Why this is a separate npm project

`package.json` in the repo root is a hot file every teammate edits, and
`AGENTS.md` asks for dependency changes to land alone. Capacitor lives here
instead, with its own lockfile, so this app adds no conflict to anyone's branch.
