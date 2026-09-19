import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { simulate } from "../shared/engine.js";
const dir = mkdtempSync(join(tmpdir(), "relay-test-"));
const token = "integration-test-only";
const server = spawn(process.execPath, ["server/index.js"], {
  env: {
    ...process.env,
    PORT: "3197",
    DATA_DIR: dir,
    APP_ACCESS_TOKEN: token,
    PATIENT_ACCESS_CODE: "patient-test-only",
    // Pinned, not inherited. This suite exercises the shared-code path, so an
    // ambient RELAY_REQUIRE_ACCOUNTS in the shell that ran it would silently
    // change what is being tested rather than fail honestly. The account path
    // has its own coverage in tests/accounts.test.js and tests/vault.test.js.
    RELAY_REQUIRE_ACCOUNTS: "false",
    RELAY_DATA_KEY: "",
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
async function request(path, body, headers = {}) {
  const response = await fetch(`http://127.0.0.1:3197/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
try {
  for (let i = 0; i < 50 && !output.includes("Relay API:"); i++) {
    if (server.exitCode !== null) throw new Error(output);
    await wait(100);
  }
  assert.equal(
    (await request("/status", undefined, { Authorization: "" })).status,
    401,
  );
  assert.equal(
    (
      await request("/voice/clinician-summary", {
        text: "Synthetic briefing text for clinician review.",
        demoSynthetic: false,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/voice/clinician-summary", {
        text: "Synthetic briefing text for clinician review.",
        demoSynthetic: true,
      })
    ).status,
    503,
  );
  assert.equal(
    (
      await request(
        "/voice/clinician-summary",
        {
          text: "Synthetic briefing text for clinician review.",
          demoSynthetic: true,
        },
        { Authorization: "Bearer patient-test-only" },
      )
    ).status,
    403,
  );
  assert.equal((await request("/patients")).data.length, 3);
  const initial = (await request("/patients/demo-01")).data;
  assert.equal(initial.evidence.state, "context");
  assert.equal(
    (await request("/patients/demo-01/checkin", { consent: false })).status,
    400,
  );
  const checkin = await request("/patients/demo-01/checkin", {
    consent: true,
    exercise: "No unusual activity",
    fatigue: "Worsening",
    medication: "No changes",
    notes: "Had a soda after soccer practice.",
    method: "ElevenLabs voice assistant",
    conversationId: "conversation-test-123",
  });
  assert.equal(checkin.data.evidence.state, "review");
  assert.equal(
    checkin.data.evidence.context.method,
    "ElevenLabs voice assistant",
  );
  assert.equal(
    checkin.data.evidence.context.conversationId,
    "conversation-test-123",
  );
  assert.equal(
    checkin.data.evidence.context.notes,
    "Had a soda after soccer practice.",
  );
  assert.equal(
    (
      await request("/patients/demo-01/checkin", {
        consent: true,
        exercise: "No unusual activity",
        fatigue: "Worsening",
        medication: "No changes",
        method: "untrusted method",
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("/patients/demo-01/consent", { consent: false })).status,
    200,
  );
  assert.equal((await request("/patients/demo-01/analyze", {})).status, 403);
  await request("/patients/demo-01/consent", { consent: true });
  assert.equal(
    (await request("/patients/demo-01/simulate", { scenario: "explained" }))
      .data.evidence.state,
    "quiet",
  );
  assert.equal(
    (
      await request(
        "/patients/demo-01/acknowledge",
        {},
        { Origin: "http://untrusted.invalid" },
      )
    ).status,
    403,
  );
  const bundle = (await request("/patients/demo-03/fhir")).data;
  assert.equal(bundle.resourceType, "Bundle");
  assert.ok(
    bundle.entry.some((e) => e.resource.resourceType === "Observation"),
  );
  assert.equal(
    (
      await request("/import", {
        dataType: "personal",
        confirmed: true,
        events: simulate(),
      })
    ).status,
    400,
  );
  const imported = await request("/import", {
    dataType: "de-identified",
    confirmed: true,
    events: simulate(),
  });
  assert.equal(imported.status, 201);
  assert.equal(
    (await request(`/patients/${imported.data.id}/voice`, { consent: true }))
      .status,
    403,
  );
  assert.equal(
    (await request("/patients/demo-01/voice", { consent: true })).status,
    503,
  );
  const audit = (await request("/audit")).data;
  assert.ok(audit.some((e) => e.action === "checkin.recorded"));
  assert.ok(audit.some((e) => e.action === "handoff.exported"));
  assert.equal(JSON.parse(readFileSync(join(dir, "state.json"))).length, 4);
  console.log(
    "API integration passed: authentication, patient analysis, check-in, consent, CSRF, import, FHIR, audit, persistence, and integration guards.",
  );
} finally {
  server.kill("SIGTERM");
}
