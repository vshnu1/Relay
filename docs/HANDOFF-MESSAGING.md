# Vishnu: patient and clinician messaging, and what it changed on the server

Written Saturday afternoon by Ian's session. It builds on Anson's accounts work
(`docs/HANDOFF-ACCOUNTS.md`); read that first if you have not. Most of this change is
in `server/`, which is your area, so this document is for you: what changed, what you
need to do on Render, how to check it, and what is still open.

## The one thing you need to do

**Set `RELAY_DEMO_PASSWORD` in the Render dashboard** (any value of 10 characters or
more), then let the service restart. Until you do, the deployed site has no standing
demo accounts and messaging can only be shown between throwaway demo identities.
Production has no default password on purpose: nobody gets a known credential on the
live site unless one of us chooses to set it.

Once it is set, these accounts exist on the deployed site and keep their identity
across sign-outs, restarts and deploys:

| Who               | Email                             | Role      | Record   |
| ----------------- | --------------------------------- | --------- | -------- |
| Dr. Elena Alvarez | `elena.alvarez@bayfront.example`  | clinician | any      |
| Dr. Naomi Park    | `naomi.park@tampageneral.example` | clinician | one unit |
| Maya Okafor       | `maya@patients.relay.example`     | patient   | `maya`   |
| Priya Nair        | `priya@patients.relay.example`    | patient   | `priya`  |

Locally (`NODE_ENV` not `production`) the password defaults to `relay-demo-2026`, so a
plain checkout can sign in as them with no setup. Every patient here is synthetic.

## What changed, in one paragraph

Messages already travelled as `message` events in the shared recovery record, but
nothing made a conversation real: accounts had no name, a patient account was not tied
to a patient record, the server stored whatever sender the browser claimed, a patient
session could post as the care team, and the record sat in plaintext on disk even with
the data key set. Now an account has a name and (for a patient) one record, the server
stamps the sender from the session, patients are limited to their own record and their
own kinds of event, and the record goes through the vault. A conversation therefore
survives either person signing out and back in, and survives a restart.

## The map

| Thing                                   | File                                           | Whose area |
| --------------------------------------- | ---------------------------------------------- | ---------- |
| `name`, `patientId`, `ensureAccount`    | `server/accounts.js`                           | yours      |
| Standing accounts, stamping, limits     | `server/index.js`                              | yours      |
| Record storage through the vault        | `server/index.js` (uses `vault.js`)            | yours      |
| The conversation, both sides            | `src/recovery/Conversation.jsx`                | Ian        |
| Its styles (own file, not recovery.css) | `src/recovery/conversation.css`                | Ian        |
| Who is signed in, for display only      | `src/recovery/model/currentUser.js`            | Ian        |
| Where it is mounted                     | `patient/Care.jsx`, `doctor/CareTeamPanel.jsx` | Ian        |
| The clinician's Messages page           | `doctor/Messages.jsx` (`#/doctor/messages`)    | Ian        |
| The suite that pins all of this         | `tests/messaging.integration.js`               | shared     |

## The contract

**A user** is now `{ id, email, role, name, patientId, careTeam, demo, createdAt }`.
`name` and `patientId` may be `null`. When there is no name the display name falls
back to the part of the email before the `@`.

**Routes that changed.** No route was added or removed.

```
POST /auth/register   email, password, invite, name?, dischargeCode?
                      -> { token, user, patient? }
POST /auth/login      email, password            -> { token, user, patient? }
POST /auth/demo       role                       -> { token, user, patient? }
```

- `dischargeCode` on register is optional and only read for a patient invite. A valid
  one binds the account to that record for good; an invalid one is a 400.
- `patient` is `{ patientId, dischargeCode }` and is present whenever the account is
  for one record. `Account.jsx` already opened a record when it saw this field, which
  is why a bound patient is not asked for a discharge code after signing in.
- A demo patient principal is now bound to the demo record on the server, not only
  handed it in the response.

**Which record a patient may reach** (`provenPatient`): an account's `patientId` wins.
The `x-relay-discharge` header is only consulted for a session that has no binding,
which keeps the shared-code mode and unbound accounts working exactly as before.

**What the server does to every stored event** (`POST /api/recovery/events`):

- adds `actorId` and `actorName` from the session, when there is one;
- for `type: "message"`, overwrites `by` with the session's role and `from` with the
  display name, so a message cannot claim a sender it does not have;
- refuses a message whose `text` is not a non-empty string of at most 2000 characters;
- refuses `discharge`, `request-checkin`, `appointment` and `acknowledge` from a
  patient session (`CLINICIAN_ONLY_EVENTS`). The patient app never sends these.

With no account session (shared-code mode, or a local checkout with no codes) there is
nobody to stamp, so `by` and `from` are stored as sent. That is deliberate: in the open
local demo every request has the clinician role, and overwriting `by` would relabel
the patient's own messages.

## Storage

The record moved from `recovery-events.jsonl` (plaintext, appended per event) to
`recovery-events.json`, written with `writeJson` and read at boot with
`readJsonOrSetAside`, the same as state, accounts and sessions. So it is encrypted
when `RELAY_DATA_KEY` is set, and an unreadable file is set aside rather than fatal,
which is the rule from Anson's landmine list.

**First boot after this deploy migrates the old file.** Each line is parsed on its own
and a corrupt line is skipped rather than costing the whole record. After the new file
is written, the old one is deleted when a key is set (leaving plaintext beside the
encrypted copy would undo the point) and renamed to `.migrated` when there is no key.
The 5000-event cap is unchanged.

One thing to know: the file is rewritten whole on each accepted batch. At demo scale
that is nothing. If a large Apple Health import ever lands in the record as one event,
this is the first place to look.

## Checking it

```bash
npm test                                   # 70
node tests/messaging.integration.js        # 6 checks, the deployed configuration
node tests/accountsMode.integration.js     # Anson's 16, still green
node tests/api.integration.js              # the shared-code path, still green
```

The messaging suite runs the server the way Render does (accounts required, a data
key, `NODE_ENV=production`) and checks: the standing accounts exist with names; a
forged sender is overwritten; a patient cannot write care-team events, reach another
record with a borrowed discharge code, or send an empty message; the thread survives
sign-out and sign-in as the same person; nothing readable is on disk; and the thread
and the accounts survive a restart.

By hand, against `npm run build && npm start` with `RELAY_REQUIRE_ACCOUNTS=true`, both
access codes, a data key and `RELAY_DEMO_PASSWORD` set:

1. Sign in through the care-team door as Dr. Alvarez, open Messages in the sidebar,
   pick Maya, send a message, sign out.
2. Sign in through the patient door as Maya. She lands on her own record with no
   discharge code asked. Care team shows the message under the doctor's name. Reply,
   sign out.
3. Sign in as Dr. Alvarez again. The reply is there and her first message reads
   "seen".

That walk-through was done in Chrome under the production content security policy with
no violations. It was done before the last merge with your `7222e84`, which conflicted
in `Root.jsx`; your version was kept and three lines were re-applied, and only the
suites and the build were re-run after that. **Nothing here has been tried on Render.**

## Frontend notes that touch your side

- The signed-in user is kept in `sessionStorage` under `rx-user`, next to `rx-code`.
  It is for display only and is never sent as proof of anything. It is cleared at
  every sign-out path in `Root.jsx`.
- Read receipts are ordinary `read` events keyed by the message's `t`. Opening the
  thread marks the other side's messages read; there is no per-message button now.
- A message is identified by its timestamp `t`. Two messages in the same millisecond
  on one record would collide. It has not mattered; an id would be the fix.
- The voice check-in is untouched.

## Still open

Ordered by what I would do first.

1. ~~Care-team scoping.~~ **Done.** A clinician account is for one care team and the
   server refuses any other record, threads included, until the clinician declares
   emergency access for it (`canReach` in `server/index.js`,
   `tests/careTeam.integration.js`). Dr. Alvarez and the demo identities are
   ward-wide on purpose; Dr. Naomi Park is for Tampa General, Cardiology, which is
   the account to sign in with to see a record refused.
2. **The sign-up form** now asks for a name and, for a patient, a discharge code.
   The server binds that patient account to the matching synthetic record so their
   messages and check-ins stay attached to the right person.
3. **Standing accounts share one identity across visitors.** Anson made demo
   identities per browser so two judges are two actors in the audit log. The standing
   accounts are the opposite trade: one name for good, so a conversation has two ends.
   The one-click demo doors are unchanged and still per browser.
4. **No rate limit** on posting events, messages included.
5. **The event `type` is still any string.** Patients are refused four kinds; an
   allow-list per role would be tighter.

## Landmines

- **The roster ids `maya` and `priya` are load-bearing.** The standing patient
  accounts are built from `src/recovery/model/simulatedSource.js`, which the server
  already imports for the discharge codes. If those ids change, the patient accounts
  are silently not created (the list is filtered against the roster) and the messaging
  suite fails on sign-in.
- **`rx-code` still carries everything**, as Anson said. `rx-user` rides beside it.
- **Every push to `main` deploys, and the site answers 502 for a minute or two.** This
  change also migrates a file on first boot. Do not push in the half hour before
  anyone records.

Anything here that is wrong, assume the document is wrong rather than the code.
