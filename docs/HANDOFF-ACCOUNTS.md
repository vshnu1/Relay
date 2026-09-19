# Ian — the accounts work, and what is left of it

Handing this over on Saturday afternoon. Everything below is on `main` and
deployed. Nothing here is half-finished in a way that breaks if you stop
reading; the list of what is left is genuinely optional, and the demo works
without any of it.

Anson asked for the handoff, so anything that reads like a decision below was
his or was made with him.

## What changed, in one paragraph

Relay used to take two shared access codes, one per role. The audit log could
say a clinician opened a record and never which clinician, which is why two
HIPAA safeguards marked **required, not addressable** were both unmet. There
are now named accounts with server-side sessions, the audit log names a person,
and the access codes have become invitations rather than credentials: a code
decides which role an account is created with and opens no record by itself.

## The map

| Thing                                | File                                | Whose area                            |
| ------------------------------------ | ----------------------------------- | ------------------------------------- |
| Account and session store            | `server/accounts.js`                | Vishnu (server)                       |
| Encryption at rest, audit hash chain | `server/vault.js`                   | Vishnu (server)                       |
| Routes and the gate                  | `server/index.js`                   | Vishnu (server)                       |
| Sign-in and sign-up screen           | `src/recovery/Account.jsx`          | **yours**                             |
| Which screen the gate shows          | `src/recovery/Root.jsx`             | **yours**                             |
| Security page                        | `src/recovery/doctor/Assurance.jsx` | mine so far, happy for it to be yours |
| Styles                               | `src/recovery/recovery.css`         | **yours**                             |

Routes, all under `/api`:

```
POST /auth/register   email, password, invite        -> { token, user }
POST /auth/login      email, password                -> { token, user }
POST /auth/demo       role: clinician | patient      -> { token, user, patient? }
GET  /auth/me                                        -> { user }
POST /auth/logout                                    -> ends the session server-side
POST /emergency-access  reason, patientId            -> a recorded declaration
GET  /safeguards                                     -> what this process is actually doing
```

The session token goes in the same `Authorization: Bearer` header the app
already sent, and it is stored in `sessionStorage` under `rx-code`, which is
where the old access code lived. **That is why no other call site changed.** If
you touch that key, everything that talks to the API goes with it.

## Running it

```bash
npm ci
npm test                                   # 70
node tests/accountsMode.integration.js     # the shipped configuration, 16 checks
node tests/api.integration.js              # the shared-code path
npm run build && npm start
```

Two modes, and the difference is one environment variable:

- **Nothing set** — shared codes work as before, no accounts, no encryption. This
  is what a plain checkout does, and what `tests/api.integration.js` pins.
- **`RELAY_REQUIRE_ACCOUNTS=true`** — accounts required, shared codes refused.
  This is what `render.yaml` sets, so the deployed site runs this.

`RELAY_DATA_KEY` turns on encryption at rest. Render generates and keeps it.
With no key the server writes plaintext exactly as before **and the security
page says so** rather than claiming otherwise.

## What is done, and verified

- Registration behind an invitation code, which chooses the role.
- Sign in, sign out, and sign-out actually ends the session on the server. That
  was the caveat under automatic logoff: the browser used to clear the tab and
  leave the credential working for anyone holding it.
- Idle 15 minutes, absolute ceiling 12 hours.
- Passwords stretched with scrypt, per-user salt, constant-time compare, and a
  hash is computed even when the account does not exist so a missing account
  and a wrong password take the same time to answer.
- A demo identity per browser, distinct, named in the audit trail. A demo
  **patient** is handed one synthetic record so the click opens the patient app
  instead of a second gate. It reaches that record and no other.
- State, accounts, sessions and every audit line encrypted when a key is set.
- The audit log is a hash chain, verified on demand, and the page reports the
  line number where the history stops adding up.
- Two doors on the sign-in screen, clinician and patient, which change the route.

## What is left

Ordered by what I would do first. None of it blocks the demo.

1. **Sign out everywhere.** `accounts.closeAllFor(userId)` exists and works and
   has no route and no button. Maybe an hour, mostly yours.
2. **Session expiry has no UX.** When the 12-hour ceiling passes mid-use, the
   next call 401s and the app drops to the sign-in screen with no explanation.
   The 15-minute idle expiry is silent as well.
3. **Care-team scoping.** This is the interesting one. `careTeam` was collected
   on the form, restricted nothing, and I removed the field. That also means
   **break-glass currently grants nothing**, because clinician access is not
   partitioned, so there is no restriction to lift. The security page says this
   plainly and marks emergency access **Partial** rather than Built. Scoping a
   clinician to patients whose hospital matches their team, with break-glass
   lifting it, would make two things real at once and is the single highest
   value item left. Server side, so Vishnu's call.
4. **Password reset.** There is no way to do it without email, and we decided
   against email. See below.
5. **Account admin.** No way to list accounts or disable one.

## Decisions already made, so you do not have to re-litigate them

**No hosted identity provider.** Anson raised Clerk and delegated the call.
Every such provider serves its SDK from its own origin, and our content
security policy is `script-src 'self'` with no third party listed at all.
Transmission security is a **built** row partly on that basis: the argument on
the page is that not even a font request tells a third party who opened a
record, which is why the typefaces are self-hosted. Adopting Clerk would trade
a safeguard we hold for two we could reach another way, and on a free tier it
buys identity without a business associate agreement, so the compliance
position would not move. The page says an identity provider under a BAA is the
right production answer, and that framing is worth keeping.

**No Resend, and no email at all.** Same objection: a third-party processor in
the path of a health application with no BAA. And email verification proves
someone controls an inbox, not that they are a clinician, so it would not close
the caveat it appears to close. Real identity proofing means a hospital
directory or an NPI number. It also puts a trip to an inbox in the middle of
the judging path.

_The project sends no email of any kind._ There is one `mailto:` link in the
patient report flow that hands a draft to the patient's own mail client, and
every care-team address is on `.example`, which cannot resolve. If anyone ever
wires a real address there, note that the draft contains the whole record and
would leave through the patient's mail client, outside every safeguard at once.

**Encryption degrades rather than breaking.** With no key the server starts and
reports itself unencrypted. This is deliberate: a missing key must not take the
service down. See the landmine below for why that sentence is in this document.

**The security page keeps its second table.** Nine of ten technical safeguards
are built. The page carries a second table underneath of what no amount of code
would fix: business associate agreements, risk analysis, workforce training,
breach procedures, review board approval, FDA clearance. A page showing only
the green table would be the kind of document this project was built to avoid.
Please do not remove it.

## What Anson has asked for, in his words as near as I can put it

- Do what is best for the project rather than what is quickest.
- Remove what does not work or is not intuitive, rather than leaving it there.
- Judges must be able to get in without creating an account, and the video
  needs an obvious way to show the clinician and patient sides as two things.
- Never paste or display an API key anywhere. Keys go in `.env`, which is
  ignored, and nothing else.
- No real health data in the repository. De-identified fixtures only.
- Every user-facing string passes the language guard. Relay never diagnoses,
  predicts risk, judges severity, recommends treatment, or escalates by itself.

## Landmines

**A rotated data key used to crash the server on boot.** Render regenerated
`RELAY_DATA_KEY`, the account store on the persistent disk had been written
under the old one, and the read threw at module scope where nothing could catch
it. The process died, Render restarted it, and the site answered 502 for as long
as that went on. It is fixed: an unreadable file is moved aside under a
timestamped name, kept rather than deleted, and reported on the security page.
**If you add another file that is read at boot, use `readJsonOrSetAside`, not
`readJson`.**

**Every push to `main` triggers a deploy, and the site 502s for a minute or two
while it happens.** Do not push in the half hour before anyone records. Open
the site a minute early to wake it; the free instance sleeps.

**Hot files.** `package.json`, `package-lock.json`, `README.md`, `.gitignore`,
`shared/engine.js`, `src/App.jsx`, `AGENTS.md`. I deliberately did not add an
npm script for the accounts integration suite to avoid touching `package.json`;
run it with `node` directly, or add the script on its own commit.

**`src/recovery/model/` must keep that name.** `.gitignore` ignores `data/` at
every depth, and a folder called `data` there gets silently dropped by
`git add`. That already cost this project a broken `main` once.

Anything here that is wrong, assume I got it wrong rather than that it changed.
