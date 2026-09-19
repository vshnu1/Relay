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

Recovery watch, at the root URL. About 100 seconds of screen time against the
2:11 script. Rehearse twice.

**Before recording**

```bash
npm run build && npm start        # serves on :3001
curl -s localhost:3001/api/status # confirm what to say about voice
```

If `voice` is `false`, say "a short consented check-in" and never "voice".

**1. The watchlist, about 15 seconds.** Open the root URL. Four sections, and
name all four: *review recommended* (2), *context needed* (12), *monitoring*
(12), *not enough data* (2).

Say the line that does the work: **most monitoring tools cannot tell you the
difference between the last two.** One is a quiet patient, the other is one
nobody can see.

Point out the signal counts — "4 of 4 signals", "2 of 4 signals" — and that
28 patients span 15 recovery pathways across 12 hospitals.

**2. Maya Okafor, about 40 seconds. This is the demo.** Click Open.

Read "What the data shows" down the left: *settled by day three, drifting on
day seven, all four signals past threshold together for thirty-eight hours,
no workout recorded that would explain it.*

Then stop on **Also recorded — sleep is 5.9 hours against a usual 7.2, not
counted for pneumonia.** Say why that sentence matters: the system is telling
you what it is deliberately ignoring.

Then **Data coverage** — which device synced, and when.

**3. Her answers, about 20 seconds.** The right panel: breathing harder, *a
lot*. Fever, *not sure*. Medicines, *no*. More active than usual, *no* — that
is what rules out exertion. Then her own words: *"I get out of breath walking
to the kitchen, and the cough is worse at night."*

**4. The squares, about 15 seconds.** Scroll to "Readings, day by day". One
square per day against her own usual, from the hospital stay through day
nine. Hatched squares are days with no reading. Note the footer: *thresholds
are demo settings, not clinically validated.*

**5. Close, about 10 seconds.** **Export handoff**, then the closing line:
Relay never says what is wrong.

**Optional, if there is time:** the Patient view toggle. Day 6 of 30, "your
care team has a few questions", and the line that keeps the boundary —
*feeling very unwell? Follow the emergency instructions in your discharge
papers.*

## Do not show

- the `#/classic` URL fragment, if the flip is in place — just open the root
- the audit page immediately after navigating; it fetches asynchronously and
  renders empty for a moment
- the check-in modal's close button as though it were the only way out;
  Escape works now
- `Local engine` beside the Simulate button, if Render is still unconfigured

## Numbers safe to quote

### Three lines to say out loud, and where

**On the security page.** "This is the HIPAA Security Rule's technical
safeguards, cite by cite. Four built, one partial, five not met — and the five
are on the screen. Unique user identification, emergency access, encryption at
rest, stored-data authentication, person authentication. We would rather show
you the gaps than have you find them."

*Nothing else on this list is more likely to land. It is the artefact a
security reviewer's whole argument says healthcare AI ships without.*

**On the import beat.** "That is a 284 MB Apple Health export. It inflates and
parses in the browser. Nothing is uploaded, and no third-party model sees it —
the one path that leaves this origin is the voice check-in, and the server
refuses it for anyone outside the synthetic cohort. It sends a first name and a
readings summary, never a surname or an identifier."

*Shadow AI — staff reaching for tools without knowing where the data goes — is
the named top risk in this field. Demonstrate it rather than assert it.*

**On the model, or when asked about regulation.** "Our reading is that Relay is
probably a regulated device. Clinical decision support is exempt under
520(o)(1)(E) only if all four criteria hold, and we fail the first: it excludes
analysing a pattern from a signal acquisition system, and that is exactly what
we do. It is written up in the repository."

*Scientists and licensing people trust teams that name their own failure
modes. Conceding this costs nothing and buys the rest of the pitch.*

### If asked about oncology

Grace Adebayo and Victor Lindqvist are discharged from Moffitt, Malignant
Hematology, on the post-chemotherapy program: temperature, resting heart rate,
heart rate variability and breathing, with mouth-sore and fever questions —
the neutropenic-fever watch. Open Grace, not a respiratory patient.

| Claim | Source |
|---|---|
| 71 people, resting HR baselines span 31 bpm, individuals vary ~2.4 | `fixtures/calibration.json` |
| Rule fires on 3.35% of subject-days on healthy people | `fixtures/calibration.json` |
| The same rule on a trailing baseline fires on 6.04% | `fixtures/calibration.json` |
| Sees a 2.0 sd coordinated change the next day; the same subjects' own noise takes five | `fixtures/sensitivity.json` |
| On one real person's gait, 30 episodes: rule sees a 2 sd decline in a day; model catches 77–90% | `fixtures/sensitivity_gait.json` |
| ML engine: 3.77%–5.77% of judged subjects across five programs; 5.77% for post-abdominal surgery | `fixtures/ml_calibration.json` |
| The model is the quiet one: speaks on 9.8% of untouched subjects, the rule on 53.7% | `fixtures/sensitivity_ml.json` |
| 99 days of real wearable data, one coordinated event found | `docs/DATA.md` |
| 60 ML tests, 39 JS tests, API integration suite | run them |

Never quote the 3.35% and the 5.77% as though one beats the other — the
first is per subject-day, the second per subject.

If a judge asks whether the 3.35% is in-sample, the answer is yes and you
should say so before they work it out: it is measured against a baseline built
from the subject's whole series, including the day being judged. It is the
right number for choosing between thresholds, because every row of that sweep
is measured the same way. The number for how often a deployment would speak on
people who are fine is the trailing one, 6.04%. `docs/DATA.md` has both and
says which belongs where. Offering this unprompted reads as rigour; being
caught on it does not.
