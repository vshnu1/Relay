// Care-team scoping and the emergency access that lifts it, in the configuration
// Render runs: accounts required, encryption on. 164.312(a)(2)(ii) was Partial
// because break-glass recorded a declaration and widened nothing. The point of this
// suite is that there is now a restriction, and that declaring an emergency is what
// lifts it, for one record, and is recorded.
//
//   node tests/careTeam.integration.js
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const dir = mkdtempSync(join(tmpdir(), "relay-careteam-"));
const PORT = "3196";
const PASSWORD = "a-demo-password-for-tests";
const CLINICIAN_CODE = "careteam-suite-clinician";
const env = {
  ...process.env,
  PORT,
  DATA_DIR: dir,
  NODE_ENV: "production",
  CLINICIAN_ACCESS_CODE: CLINICIAN_CODE,
  PATIENT_ACCESS_CODE: "careteam-suite-patient",
  APP_ACCESS_TOKEN: "unused-but-required-in-production",
  RELAY_REQUIRE_ACCOUNTS: "true",
  RELAY_DATA_KEY: "c".repeat(64),
  RELAY_DEMO_PASSWORD: PASSWORD,
  RELAY_ML_ENABLED: "false",
  RENDER_API_KEY: "",
  RENDER_WORKFLOW_SLUG: "",
  ELEVENLABS_API_KEY: "",
  ELEVENLABS_AGENT_ID: "",
};
const base = `http://127.0.0.1:${PORT}`;
let server;
let output = "";
async function start() {
  server = spawn(process.execPath, ["server/index.js"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (x) => (output += x));
  server.stderr.on("data", (x) => (output += x));
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error("server exited:\n" + output);
    try {
      if ((await fetch(base + "/api/safeguards")).status) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start:\n" + output);
}
const stop = () =>
  new Promise((done) => (server.once("exit", done), server.kill("SIGTERM")));
const call = async (path, { method = "GET", body, token } = {}) => {
  const response = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      origin: base,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json().catch(() => ({})),
  };
};
const signIn = async (email) => {
  const r = await call("/api/auth/login", {
    method: "POST",
    body: { email, password: PASSWORD },
  });
  assert.equal(r.status, 200, `sign in as ${email}`);
  return r.body;
};
const message = (patientId, text, eid) => ({
  type: "message",
  patientId,
  eid,
  t: Date.now(),
  by: "clinician",
  from: "whoever",
  text,
});

// In the synthetic roster: daniel is Tampa General, Cardiology; maya is Bayfront
// Health, Respiratory Unit.
const OWN = "daniel";
const OTHER = "maya";

try {
  await start();

  // 1. The standing accounts carry their assignment, and the security page counts it.
  const wide = await signIn("elena.alvarez@bayfront.example");
  const scoped = await signIn("naomi.park@tampageneral.example");
  assert.equal(wide.user.careTeam, "*");
  assert.equal(scoped.user.careTeam, "Tampa General, Cardiology");
  const before = await call("/api/safeguards", { token: wide.token });
  assert.ok(before.body.accessScoping.careTeams > 1);
  assert.ok(before.body.accessScoping.scopedAccounts >= 1);
  console.log("ok 1 accounts are assigned to a care team or to the whole ward");

  // Something in both records, written by the ward-wide clinician.
  const seeded = await call("/api/recovery/events", {
    method: "POST",
    token: wide.token,
    body: {
      events: [
        message(OWN, "For a patient on the scoped team.", "ct-own-1"),
        message(OTHER, "For a patient on another team.", "ct-other-1"),
      ],
    },
  });
  assert.equal(seeded.body.accepted.length, 2);

  // 2. A scoped clinician reads their own team's record and is refused another's.
  const own = await call(`/api/recovery/events?after=0&patientId=${OWN}`, {
    token: scoped.token,
  });
  assert.equal(own.status, 200);
  assert.equal(own.body.events.length, 1);
  const refused = await call(
    `/api/recovery/events?after=0&patientId=${OTHER}`,
    {
      token: scoped.token,
    },
  );
  assert.equal(refused.status, 403);
  assert.equal(refused.body.code, "OUTSIDE_CARE_TEAM");
  console.log("ok 2 a record outside the care team is refused");

  // 3. The ward-wide poll leaves those records out instead of failing.
  const ward = await call("/api/recovery/events?after=0", {
    token: scoped.token,
  });
  assert.equal(ward.status, 200);
  assert.deepEqual(
    [...new Set(ward.body.events.map((e) => e.patientId))],
    [OWN],
  );
  console.log("ok 3 the ward poll carries only the care team's records");

  // 4. Nor can they write to one.
  const write = await call("/api/recovery/events", {
    method: "POST",
    token: scoped.token,
    body: {
      events: [
        message(OTHER, "Should be dropped.", "ct-other-2"),
        message(OWN, "Should be kept.", "ct-own-2"),
      ],
    },
  });
  assert.equal(write.body.accepted.length, 1);
  console.log("ok 4 a write to a record outside the care team is dropped");

  // 5. Emergency access needs a reason, and lifts the restriction for that record.
  const lazy = await call("/api/emergency-access", {
    method: "POST",
    token: scoped.token,
    body: { patientId: OTHER, reason: "urgent" },
  });
  assert.equal(lazy.status, 400);
  const opened = await call("/api/emergency-access", {
    method: "POST",
    token: scoped.token,
    body: {
      patientId: OTHER,
      reason:
        "Covering the respiratory unit overnight, patient is on the phone.",
    },
  });
  assert.equal(opened.status, 200);
  assert.equal(opened.body.patientId, OTHER);
  const lifted = await call(`/api/recovery/events?after=0&patientId=${OTHER}`, {
    token: scoped.token,
  });
  assert.equal(lifted.status, 200);
  assert.equal(lifted.body.events.length, 1);
  // One record, not the ward: a third team's record is still refused.
  const third = await call("/api/recovery/events?after=0&patientId=priya", {
    token: scoped.token,
  });
  assert.equal(third.status, 403);
  const mine = await call("/api/emergency-access", { token: scoped.token });
  assert.equal(mine.body.open.length, 1);
  assert.equal(mine.body.open[0].patientId, OTHER);
  console.log(
    "ok 5 declaring an emergency opens that one record, with a reason",
  );

  // 6. All of it is in the audit chain: the refusal, the declaration, and the read
  //    that only happened because of it, marked as such. The chain still verifies.
  const audit = await call("/api/audit", { token: wide.token });
  const lines = audit.body;
  assert.ok(
    lines.some((l) => l.action === "access.refused" && l.patientId === OTHER),
  );
  assert.ok(
    lines.some(
      (l) => l.action === "emergency.access_opened" && l.patientId === OTHER,
    ),
  );
  assert.ok(
    lines.some(
      (l) =>
        l.action === "recovery.read" &&
        l.patientId === OTHER &&
        l.onBehalfOf === "break-glass" &&
        l.actorEmail === "naomi.park@tampageneral.example",
    ),
  );
  const after = await call("/api/safeguards", { token: wide.token });
  assert.equal(after.body.auditChain.intact, true);
  assert.equal(after.body.emergencyAccess.open.length, 1);
  console.log(
    "ok 6 the refusal, the declaration and the read are all on the chain",
  );

  // 7. Signing up names a care team, and an invented one is refused. A ward-wide
  //    identity (the demo door) is unaffected by any of the above.
  const bad = await call("/api/auth/register", {
    method: "POST",
    body: {
      email: "nobody@example.org",
      password: PASSWORD,
      invite: CLINICIAN_CODE,
      name: "Nobody",
      careTeam: "A unit that does not exist",
    },
  });
  assert.equal(bad.status, 400);
  const joined = await call("/api/auth/register", {
    method: "POST",
    body: {
      email: "new.nurse@example.org",
      password: PASSWORD,
      invite: CLINICIAN_CODE,
      name: "New Nurse",
      careTeam: "Bayfront Health, Respiratory Unit",
    },
  });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.user.careTeam, "Bayfront Health, Respiratory Unit");
  const nurseOther = await call(
    `/api/recovery/events?after=0&patientId=${OWN}`,
    {
      token: joined.body.token,
    },
  );
  assert.equal(nurseOther.status, 403);
  const demo = await call("/api/auth/demo", {
    method: "POST",
    body: { role: "clinician" },
  });
  assert.equal(demo.body.user.careTeam, "*");
  const demoReads = await call(
    `/api/recovery/events?after=0&patientId=${OTHER}`,
    {
      token: demo.body.token,
    },
  );
  assert.equal(demoReads.status, 200);
  console.log(
    "ok 7 sign-up names a care team; the demo identity stays ward-wide",
  );

  console.log(
    "\nCare-team integration passed: scoped reads and writes, a ward poll that leaves other teams out, and emergency access that lifts the restriction for one record and is recorded.",
  );
} catch (error) {
  console.error(error);
  console.error(output.slice(-1500));
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) await stop();
}
