# Demo runbook

Two things: the click path for whoever records, and a verified recovery
procedure if the frontend is still broken when it is time to record.

## Recovery: if `src/recovery/data/` never arrives

`main` cannot build. Four modules are imported but were never committed —
`.gitignore` had an unanchored `data/` rule that silently matched
`src/recovery/data/` at any depth, so `git add` discarded them without a
word. The rule is fixed (`/data/`), but the files themselves only exist on
Ian's machine.

### Option A — Ian pushes. Preferred.

```bash
git pull
git add src/recovery/data/
git commit -m "Add recovery data modules"
git push
```

Thirty seconds, and it fixes the build, `npm test`, and the Render deploy.

### Option B — flip the default back. Verified, 4 lines, reversible.

`src/main.jsx` currently makes Ian's recovery view the default and moves the
four-screen workspace to `#/classic`. Reverting that one file removes
`Root.jsx` from the module graph, so the missing imports are never resolved
and the build passes. **Ian's files stay in the repo untouched.**

```bash
cat > src/main.jsx <<'ENTRY'
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/index.css";
createRoot(document.getElementById("root")).render(<App />);
ENTRY
npm run build   # verified: builds in 1.28s
```

`tests/recovery.test.js` still fails, because it imports the missing modules
directly. Either delete that one file or accept 8 of 9 passing — the build
and the deploy are what matter.

Tested end to end at commit `093ad6c` (the last before the frontend change):
clean install, clean build, 8/8 tests, server boots, the workspace renders,
all three demo scenarios return their expected states. **The fallback is
demo-ready, not theoretical.**

## The click path

Roughly 100 seconds of screen time against a 2:07 script. Rehearse it twice.

**Before recording**

```bash
npm run build && npm start        # serves on :3001
curl -s localhost:3001/api/status # confirm what to say about voice
```

If `voice` is `false`, say "a short consented check-in" and never "voice".
If `render` is `false`, do not linger on the "Local engine" label beside the
Simulate button.

Reset to the unanswered state so the check-in is available:

```bash
curl -s -X POST localhost:3001/api/patients/demo-01/scenario \
  -H 'content-type: application/json' -d '{"scenario":"ambiguous"}'
```

**1. Dashboard, about 10 seconds.** Four tiles: 3 monitored, 1 ready for
review, 1 awaiting context, 3 of 3 consented. Then the triage list — Alex
Morgan "Context needed", Jordan Lee "No review trigger", Sam Rivera "Ready
for review". Say: a nurse knows who to look at in two seconds.

**2. The timeline, about 40 seconds. This is the demo.** Scroll to resting
heart rate. Point at the dotted `BASELINE 64.0` line: *that is his normal,
not a threshold.* Then run down the five charts — HRV -24.1%, respiratory
+16.8%, sleep -22%, glucose +19.1%. Say the line that matters: **none of
these is abnormal on its own. 73 bpm is a healthy resting heart rate.**

Mention `Available · 56 baseline samples` under a chart — the evidence behind
the baseline is on screen.

**3. The evidence sheet, about 20 seconds.** Read the generated summary
aloud, then say what it does *not* contain: no condition, no risk score, no
urgency. Point at "Contributing signals".

**4. The check-in, about 20 seconds.** Click **Gather patient context**.
Consent first, then the structured questions. Answer them, save, and show the
state move to "Ready for review" with the patient's answers folded into the
summary.

**5. Close, about 10 seconds.** **View mock FHIR handoff.** Then the line
that ends the pitch: Relay never says what is wrong.

## Do not show

- the `#/classic` URL fragment, if the flip is in place — just open the root
- the audit page immediately after navigating; it fetches asynchronously and
  renders empty for a moment
- the check-in modal's close button as though it were the only way out;
  Escape works now
- `Local engine` beside the Simulate button, if Render is still unconfigured

## Numbers safe to quote

| Claim | Source |
|---|---|
| 71 people, resting HR baselines span 31 bpm, individuals vary ~2.4 | `fixtures/calibration.json` |
| Rule fires on 3.35% of subject-days on healthy people | `fixtures/calibration.json` |
| ML engine: 5.77% of judged subjects | `fixtures/ml_calibration.json` |
| 99 days of real wearable data, one coordinated event found | `docs/DATA.md` |
| 53 ML tests, 8 JS tests, API integration suite | run them |

Never quote the 3.35% and the 5.77% as though one beats the other — the
first is per subject-day, the second per subject.
