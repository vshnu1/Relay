# Demo runbook

The click path for whoever records, the three lines worth saying out loud, and
where every number in them comes from.

## Before you record

Nothing here needs a fallback any more. This section used to carry one, for a
build that could not run: four modules were imported and never committed,
because an unanchored `data/` rule in `.gitignore` matched `src/recovery/data/`
at any depth and `git add` dropped them without a word. The folder was renamed
to `src/recovery/model/` and the rule anchored to `/data/`, which is why it is
called `model/` and must stay called that.

Check these four and record:

```bash
npm ci
npm test                    # 46 pass
npm run build               # about 1.4s
npm start                   # then open http://127.0.0.1:3001
```

The deployed copy is <https://relay-bayhacks.onrender.com>. It is a free Render
instance and sleeps when idle, so open it a minute before you record and let the
first request wake it.

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
name all four: _review recommended_ (2), _context needed_ (12), _monitoring_
(12), _not enough data_ (2).

Say the line that does the work: **most monitoring tools cannot tell you the
difference between the last two.** One is a quiet patient, the other is one
nobody can see.

Point out the signal counts — "4 of 4 signals", "2 of 4 signals" — and that
28 patients span 15 recovery pathways across 13 hospital units.

**2. Maya Okafor, about 40 seconds. This is the demo.** Click Open.

Read "What the data shows" down the left: _settled by day three, drifting on
day seven, all four signals past threshold together for thirty-five hours,
no workout recorded that would explain it._

Then stop on **Also recorded — sleep is 5.9 hours against a usual 7.2, not
counted for pneumonia.** Say why that sentence matters: the system is telling
you what it is deliberately ignoring.

Then **Data coverage** — which device synced, and when.

**3. Her answers, about 20 seconds.** The right panel: breathing harder, _a
lot_. Fever, _not sure_. Medicines, _no_. More active than usual, _no_ — that
is what rules out exertion. Then her own words: _"I get out of breath walking
to the kitchen, and the cough is worse at night."_

**4. The squares, about 15 seconds.** Scroll to "Readings, day by day". One
square per day against her own usual, from the hospital stay through day
nine. Hatched squares are days with no reading. Note the footer: _thresholds
are demo settings, not clinically validated._

**5. Close, about 10 seconds.** **Export handoff**, then the closing line:
Relay never says what is wrong.

**Optional, if there is time:** the Patient view toggle. Day 6 of 30, "your
care team has a few questions", and the line that keeps the boundary —
_feeling very unwell? Follow the emergency instructions in your discharge
papers._

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

_Nothing else on this list is more likely to land. It is the artefact a
security reviewer's whole argument says healthcare AI ships without._

**On the import beat.** "That is a 284 MB Apple Health export. It inflates and
parses in the browser. Nothing is uploaded, and no third-party model sees it —
the one path that leaves this origin is the voice check-in, and the server
refuses it for anyone outside the synthetic cohort. It sends a first name and a
readings summary, never a surname or an identifier."

_Shadow AI — staff reaching for tools without knowing where the data goes — is
the named top risk in this field. Demonstrate it rather than assert it._

**On the model, or when asked about regulation.** "Our reading is that Relay is
probably a regulated device. Clinical decision support is exempt under
520(o)(1)(E) only if all four criteria hold, and we fail the first: it excludes
analysing a pattern from a signal acquisition system, and that is exactly what
we do. It is written up in the repository."

_Scientists and licensing people trust teams that name their own failure
modes. Conceding this costs nothing and buys the rest of the pitch._

### If asked about oncology

Grace Adebayo and Victor Lindqvist are discharged from Moffitt, Malignant
Hematology, on the post-chemotherapy program: temperature, resting heart rate,
heart rate variability and breathing, with mouth-sore and fever questions —
the neutropenic-fever watch. Open Grace, not a respiratory patient.

| Claim                                                                                            | Source                           |
| ------------------------------------------------------------------------------------------------ | -------------------------------- |
| 66 people with usable baselines, resting HR spans 31 bpm, individuals vary ~2.4                  | `fixtures/calibration.json`      |
| Rule fires on 3.35% of subject-days on healthy people                                            | `fixtures/calibration.json`      |
| The same rule on a trailing baseline fires on 6.04%                                              | `fixtures/calibration.json`      |
| Sees a 2.0 sd coordinated change the next day; the same subjects' own noise takes five           | `fixtures/sensitivity.json`      |
| On one real person's gait, 30 episodes: rule sees a 2 sd decline in a day; model catches 77–90%  | `fixtures/sensitivity_gait.json` |
| ML engine: 3.77%–5.77% of judged subjects across five programs; 5.77% for post-abdominal surgery | `fixtures/ml_calibration.json`   |
| The model is the quiet one: speaks on 9.8% of untouched subjects, the rule on 53.7%              | `fixtures/sensitivity_ml.json`   |
| 99 days of real wearable data, one coordinated event found                                       | `docs/DATA.md`                   |
| 60 ML tests, 46 JS tests, API integration suite                                                  | run them                         |

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
