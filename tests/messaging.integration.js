// Messaging on top of accounts, in the configuration Render runs: accounts
// required, encryption on. The point of the suite is that a conversation EXISTS:
// it is between two named people, it survives either of them signing out and back
// in, and it survives the server restarting.
//
//   node tests/messaging.integration.js
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const dir = mkdtempSync(join(tmpdir(), "relay-messaging-"));
const PORT = "3199";
const PASSWORD = "a-demo-password-for-tests";
const env = {
  ...process.env,
  PORT,
  DATA_DIR: dir,
  NODE_ENV: "production",
  CLINICIAN_ACCESS_CODE: "clinician-invite-only",
  PATIENT_ACCESS_CODE: "patient-invite-only",
  APP_ACCESS_TOKEN: "unused-but-required-in-production",
  RELAY_REQUIRE_ACCOUNTS: "true",
  RELAY_DATA_KEY: "e".repeat(64),
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
const call = async (path, { method = "GET", body, token, discharge } = {}) => {
  const response = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      origin: base,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(discharge ? { "x-relay-discharge": discharge } : {}),
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
  assert.equal(
    r.status,
    200,
    `${email} can sign in: ${JSON.stringify(r.body)}`,
  );
  return r.body;
};
const post = (token, events, extra = {}) =>
  call("/api/recovery/events", {
    method: "POST",
    token,
    body: { events },
    ...extra,
  });
const thread = async (token, patientId) =>
  (
    await call(`/api/recovery/events?after=0&patientId=${patientId}`, { token })
  ).body.events.filter((e) => e.type === "message");
let n = 0;
const message = (patientId, fields) => ({
  type: "message",
  patientId,
  eid: `test-${++n}`,
  t: Date.now() + n,
  ...fields,
});
const ok = (label) => console.log("  ok   " + label);

try {
  await start();

  // ---- two standing people, and a patient account that is for one record ----
  const doctor = await signIn("elena.alvarez@bayfront.example");
  const maya = await signIn("maya@patients.relay.example");
  assert.equal(doctor.user.name, "Dr. Elena Alvarez");
  assert.equal(doctor.user.role, "clinician");
  assert.equal(maya.user.role, "patient");
  assert.equal(maya.user.patientId, "maya");
  assert.equal(
    maya.patient.patientId,
    "maya",
    "sign-in hands the patient her own record",
  );
  ok(
    "standing demo accounts exist, with names, and the patient account is for one record",
  );

  // ---- a conversation, stamped by the server ----
  await post(doctor.token, [
    message("maya", {
      by: "clinician",
      from: "whatever the browser says",
      text: "How is your breathing today?",
    }),
  ]);
  await post(maya.token, [
    message("maya", {
      by: "clinician",
      from: "Dr. Fake",
      text: "A little harder than yesterday.",
    }),
  ]);
  let seen = await thread(doctor.token, "maya");
  assert.equal(seen.length, 2);
  assert.deepEqual(
    [seen[0].by, seen[0].from],
    ["clinician", "Dr. Elena Alvarez"],
  );
  assert.deepEqual(
    [seen[1].by, seen[1].from],
    ["patient", maya.user.name],
    "a patient cannot send as the care team",
  );
  assert.equal(seen[1].actorId, maya.user.id);
  ok(
    "the sender is taken from the session: a forged name and role are overwritten",
  );

  // ---- what a patient may not do ----
  const forged = await post(maya.token, [
    {
      type: "discharge",
      patientId: "maya",
      eid: "test-discharge",
      notes: "rewritten by the patient",
    },
  ]);
  assert.deepEqual(
    forged.body.accepted,
    [],
    "a patient cannot write care-team events",
  );
  const other = await post(
    maya.token,
    [message("priya", { text: "into someone else's thread" })],
    { discharge: "anything" },
  );
  assert.deepEqual(other.body.accepted, []);
  const peek = await call("/api/recovery/events?after=0&patientId=priya", {
    token: maya.token,
    discharge: "BAY-2741",
  });
  assert.equal(
    peek.status,
    403,
    "the account decides the record, not a header the browser can change",
  );
  const empty = await post(maya.token, [message("maya", { text: "   " })]);
  assert.deepEqual(empty.body.accepted, []);
  ok(
    "a patient cannot write care-team events, reach another record, or send an empty message",
  );

  // ---- the conversation exists: sign out, sign back in ----
  await call("/api/auth/logout", { method: "POST", token: maya.token });
  assert.equal(
    (
      await call(`/api/recovery/events?after=0&patientId=maya`, {
        token: maya.token,
      })
    ).status,
    401,
    "the old session is dead",
  );
  const mayaAgain = await signIn("maya@patients.relay.example");
  assert.equal(
    mayaAgain.user.id,
    maya.user.id,
    "the same person, not a new one",
  );
  seen = await thread(mayaAgain.token, "maya");
  assert.deepEqual(
    seen.map((m) => m.text),
    ["How is your breathing today?", "A little harder than yesterday."],
  );
  ok(
    "messages survive signing out and signing back in, and she is the same person",
  );

  // ---- and a restart, which is what a deploy is ----
  await stop();
  const onDisk = readdirSync(dir)
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  assert.ok(
    !onDisk.includes("How is your breathing today?"),
    "no message text is readable on disk",
  );
  assert.ok(!onDisk.includes("Dr. Elena Alvarez"));
  ok("with a data key set, neither messages nor names are readable on disk");
  await start();
  const doctorAgain = await signIn("elena.alvarez@bayfront.example");
  assert.equal(doctorAgain.user.id, doctor.user.id);
  seen = await thread(doctorAgain.token, "maya");
  assert.equal(
    seen.length,
    2,
    "the conversation is still there after a restart",
  );
  await post(doctorAgain.token, [
    message("maya", {
      text: "Thank you. We will look at your readings this afternoon.",
    }),
  ]);
  assert.equal((await thread(doctorAgain.token, "maya")).length, 3);
  ok(
    "messages and accounts survive a server restart, and the thread can continue",
  );

  console.log(
    "\nMessaging integration passed: named standing accounts, server-stamped senders, role limits, and a conversation that survives sign-out, sign-in and restart.",
  );
} catch (error) {
  console.error("\nFAILED: " + error.message);
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) await stop();
}
