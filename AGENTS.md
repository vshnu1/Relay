# Working in this repo — people and AI agents

Four of us are building in parallel against a hard deadline (Sept 19, 2026, 7 PM ET). These rules exist for one reason: merges should be boring. Product context is in `README.md`.

## Who owns what

Edit files in your own area. If a task needs a change somewhere else, ask that owner — do not make the edit yourself.

| Area                | Paths                                                                                                                        | Owner  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------ |
| Frontend UI         | `src/**` except `src/voice.js`, `index.html`, `vite.config.js`                                                               | Ian    |
| Voice (ElevenLabs)  | `src/voice.js`, `docs/voice-agent.md`, the `/voice` route in `server/index.js`                                               | Vishnu |
| API and Render      | `server/**`, `workflows/**`, `render.yaml`, `tests/api.*`, `tests/workflow.*`                                                | Vishnu |
| Data and validation | `analysis/**`, `pipeline/**`, `fixtures/**`, `tools/**`, `scripts/**`, `docs/DATA.md`, `docs/INTEROP.md`, `docs/PIPELINE.md` | Anson  |
| ML and synthetic    | `ml/**`, `docs/ML.md`                                                                                                        | Pranav |
| Demo, pitch, video  | unassigned — claim it by editing this row                                                                                    | —      |

AI agents: branches are named after people, so the branch tells you whose area you are in. Check every path against this table before editing. If the task needs a file outside your operator's area, stop and say so instead of editing it.

## Hot files — one editor at a time

Say so in the team chat _before_ touching any of these, and land the change on its own, quickly:

`package.json` · `package-lock.json` · `README.md` · `.gitignore` · `.env.example` · `shared/engine.js` · `src/App.jsx` · this file

`shared/engine.js` is imported by the server, the workflow tasks, and three test files. Changing its output shape breaks the UI silently, so agree on the shape first.

## Rules that prevent most conflicts

1. **Never copy files between branches.** Branch or merge instead. Copied files share no history, so git reports a conflict on every later edit by either side, even in regions only one person touched.
2. **Do not reformat, rename, or move a file you are not otherwise changing.** Prettier config is pinned in `.prettierrc`; use it, and only on files you own.
3. **New behavior goes in a new file** rather than growing a shared one. Two people adding two files never conflict.
4. **Dependencies:** install with `npm ci`. Run `npm install <pkg>` only to add one, and commit `package.json` + `package-lock.json` together in a commit that contains nothing else. If the lockfile conflicts, resolve `package.json`, then run `npm install --package-lock-only`. Never hand-edit the lockfile.
5. **Sync at least hourly:** `git fetch && git merge origin/main` (or wherever the app currently lives — `origin/Vishnu` until it lands on `main`). Small conflicts now beat one large conflict at 4 AM.
6. **Look before you leap:** `scripts/check-conflicts.sh` dry-runs a merge of your branch against every teammate branch and lists the files that would conflict. It changes nothing. Run it before starting anything large and before every push.
7. Commit small, push often. Nobody can avoid work they cannot see.

One-time setup per clone:

```sh
git config rerere.enabled true          # remembers how you resolved a conflict
git config merge.conflictstyle zdiff3   # shows the common ancestor in conflict hunks
```

## Frontend map

Two apps share `src/main.jsx` and are never loaded together, so their global styles cannot collide.

### Recovery watch: `src/recovery/` (the default app)

The doctor and patient views for the post-discharge mission. `Root.jsx` holds the demo bar that switches roles.

- `model/contract.js` is the seam to the backend and hardware. Read it before connecting a feed. A source delivers a roster, raw readings, and device state; nothing else.
- `model/simulatedSource.js` is today's source. To go live, write another source to the same contract and change the one `createStore(...)` line in `useRecovery.js`. No view changes.
- `model/derive.js` turns raw readings into every status, number, sentence, and chart point. It is pure and covered by `tests/recovery.test.js`. **The UI stores no computed values**, so late or out-of-order readings are safe.
- `model/profiles.js` is the illness table: which signals count, in which direction, past what threshold, and which questions are asked. Illustrative until a clinician signs it off.
- `doctor/`, `patient/` are the screens. They read derived state and call `actions`; they never fetch.

Never name a source folder `data`. `.gitignore` ignores `data/` at every depth to keep real health data out of git, so such a folder is silently left out of commits. That is why this one is called `model/`.

### Classic workspace: everything else in `src/` (at `#/classic`)

The original app, wired to the real API, Render Workflows, and ElevenLabs. `src/App.jsx` holds shared state and the API handlers and composes everything else; keep it thin.

- `src/pages/` — one file per sidebar page. `pages/workspace/` holds the panels of the main monitoring screen.
- `src/modals/` — one file per dialog. `Modal.jsx` is the shared shell.
- `src/components/` — shared pieces (sidebar, top bar, stats, badge, chart).
- `src/api.js`, `src/format.js` — fetch helper and display formatting.
- `src/voice.js` — all ElevenLabs session logic. The check-in dialog calls `startVoiceSession()` and nothing else, so voice work and UI work stay in separate files.
- `src/styles/` — one stylesheet per area, imported in a fixed order by `styles/index.css`. Breakpoint overrides live in `responsive.css` and must stay last.
