// The configuration the deployment actually runs: accounts required, data
// encrypted at rest. tests/api.integration.js covers the shared-code path, and
// pins itself to it, so without this file the production mode had no coverage
// at the HTTP layer at all.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const dir = mkdtempSync(join(tmpdir(), "relay-accounts-"));
const PORT = "3198";
const server = spawn(process.execPath, ["server/index.js"], {
  env: {
    ...process.env,
    PORT,
    DATA_DIR: dir,
    CLINICIAN_ACCESS_CODE: "clinician-invite-only",
    PATIENT_ACCESS_CODE: "patient-invite-only",
    APP_ACCESS_TOKEN: "",
    RELAY_REQUIRE_ACCOUNTS: "true",
    RELAY_DATA_KEY: "f".repeat(64),
    RELAY_ML_ENABLED: "false",
    RENDER_API_KEY: "",
    RENDER_WORKFLOW_SLUG: "",
    ELEVENLABS_API_KEY: "",
    ELEVENLABS_AGENT_ID: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (x) => (output += x));
server.stderr.on("data", (x) => (output += x));

const base = `http://127.0.0.1:${PORT}`;
const call = async (path, { method = "GET", body, token } = {}) => {
  const response = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
};

const ready = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(base + "/api/status");
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return false;
};

let failures = 0;
const check = (label, fn) => {
  try {
    fn();
    console.log(`  ok   ${label}`);
  } catch (error) {
    failures++;
    console.log(`  FAIL ${label}\n       ${error.message}`);
  }
};

try {
  assert.ok(await ready(), `server did not start:\n${output}`);

  // A shared code is no longer a credential here.
  const code = await call("/api/patients", { token: "clinician-invite-only" });
  check("a role code alone no longer reaches a record", () => {
    assert.equal(code.status, 401);
    assert.equal(code.body.code, "ACCOUNT_REQUIRED");
  });

  const noInvite = await call("/api/auth/register", {
    method: "POST",
    body: { email: "a@b.co", password: "a-long-enough-password", invite: "guess" },
  });
  check("registration needs a real invitation", () =>
    assert.equal(noInvite.status, 403),
  );

  const registered = await call("/api/auth/register", {
    method: "POST",
    body: {
      email: "elena@bayfront.test",
      password: "a-long-enough-password",
      invite: "clinician-invite-only",
      careTeam: "Bayfront Health",
    },
  });
  check("the invitation creates an account and opens a session", () => {
    assert.equal(registered.status, 200);
    assert.equal(registered.body.user.role, "clinician");
    assert.equal(typeof registered.body.token, "string");
  });
  const token = registered.body.token;

  const ward = await call("/api/patients", { token });
  check("that session reaches the ward", () => assert.equal(ward.status, 200));

  const me = await call("/api/auth/me", { token });
  check("the session names the person", () =>
    assert.equal(me.body.user.email, "elena@bayfront.test"),
  );

  // The role code decides the role, and a patient code cannot make a clinician.
  const asPatient = await call("/api/auth/register", {
    method: "POST",
    body: {
      email: "maya@home.test",
      password: "a-long-enough-password",
      invite: "patient-invite-only",
    },
  });
  check("a patient invitation creates a patient", () =>
    assert.equal(asPatient.body.user.role, "patient"),
  );
  const patientWard = await call("/api/patients", { token: asPatient.body.token });
  check("a patient account still cannot list the ward", () =>
    assert.equal(patientWard.status, 403),
  );

  // Break-glass.
  const noReason = await call("/api/emergency-access", {
    method: "POST",
    token,
    body: { reason: "urgent" },
  });
  check("emergency access refuses a reason too short to be one", () =>
    assert.equal(noReason.status, 400),
  );
  const granted = await call("/api/emergency-access", {
    method: "POST",
    token,
    body: {
      reason: "Covering another team overnight, patient deteriorating at home.",
      patientId: "maya",
    },
  });
  check("emergency access is granted with a reason", () =>
    assert.equal(granted.status, 200),
  );

  const safeguards = await call("/api/safeguards", { token });
  check("the safeguards report describes this process, not an intention", () => {
    assert.equal(safeguards.status, 200);
    assert.equal(safeguards.body.encryptionAtRest.mode, "aes-256-gcm");
    assert.equal(safeguards.body.identity.accountsRequired, true);
    assert.equal(safeguards.body.identity.sharedCodesAccepted, false);
    assert.equal(safeguards.body.auditChain.intact, true);
    assert.ok(safeguards.body.auditChain.lines > 0);
    assert.equal(safeguards.body.emergencyAccess.open.length, 1);
  });

  const audit = await call("/api/audit", { token });
  check("the audit log names the person, not only the role", () => {
    const mine = audit.body.filter((r) => r.actorEmail === "elena@bayfront.test");
    assert.ok(mine.length > 0, "no line attributed to the acting account");
    assert.ok(mine.some((r) => r.action === "emergency.access_opened"));
  });

  await call("/api/auth/logout", { method: "POST", token });
  const afterLogout = await call("/api/patients", { token });
  check("signing out revokes the session on the server", () =>
    assert.equal(afterLogout.status, 401),
  );
} finally {
  server.kill();
}

if (failures) {
  console.error(`\nAccounts-mode integration FAILED: ${failures} check(s).`);
  process.exit(1);
}
console.log("\nAccounts-mode integration passed: invitation, session, role scoping, break-glass, encrypted at rest, chained audit naming the actor, server-side revocation.");
