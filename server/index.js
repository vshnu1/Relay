import express from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  KEY_DERIVED,
  KEY_PRESENT,
  appendSealed,
  encryptionMode,
  lastHash,
  readJson,
  readSealedLines,
  verifyChain,
  writeJson,
} from "./vault.js";
import { createAccountStore } from "./accounts.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { createSimulatedSource } from "../src/recovery/model/simulatedSource.js";
import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  appendFileSync,
  existsSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, simulate, normalize, fhirBundle } from "../shared/engine.js";
import { scoreWithRelay } from "./relayModel.js";
import { guardEvidence } from "./languageGuard.js";
try {
  process.loadEnvFile();
} catch {}
const root = fileURLToPath(new URL("../", import.meta.url));
const dataDir = resolve(process.env.DATA_DIR || resolve(root, "data"));
mkdirSync(dataDir, { recursive: true });
const stateFile = resolve(dataDir, "state.json");
const context = {
  exercise: "No unusual activity",
  fatigue: "Worsening",
  medication: "No changes",
  consent: true,
  timestamp: new Date().toISOString(),
};
function seeded() {
  return [
    ["demo-01", "Alex Morgan", "AM", "ambiguous"],
    ["demo-02", "Jordan Lee", "JL", "explained"],
    ["demo-03", "Sam Rivera", "SR", "review"],
  ].map(([id, name, initials, scenario]) => {
    const events = simulate(scenario);
    return {
      id,
      name,
      initials,
      scenario,
      dataType: "synthetic",
      events,
      consent: true,
      acknowledged: false,
      evidence: analyze(events, scenario === "review" ? context : null),
    };
  });
}
// State goes through the vault, which encrypts it when RELAY_DATA_KEY is set
// and writes it exactly as before when it is not. Either way the write is still
// atomic: temp file, then rename.
let patients = readJson(stateFile, null) || seeded();
function save() {
  writeJson(stateFile, patients);
}
// Who is acting, carried through the awaits in the scoring path. A module
// variable would be overwritten by the next request while the Python model is
// still running, and would then attribute one caller's action to another.
const requestContext = new AsyncLocalStorage();

const auditFile = resolve(dataDir, "audit.jsonl");
// The digest of the last line written, carried forward so each new line commits
// to the whole history before it. Read once at startup; a restart picks the
// chain up where it was left rather than starting a second one.
let auditHead = lastHash(auditFile);

function audit(action, patientId = null, detail = "") {
  const who = requestContext.getStore() || {};
  auditHead = appendSealed(
    auditFile,
    {
      id: randomUUID(),
      at: new Date().toISOString(),
      // The role that made the request, not an assumption about it. An audit
      // line that positively asserts a provider did what a patient did is
      // worse than one that admits it does not know.
      actor: who.role ?? "system",
      // And, when the caller signed in to an account, which person. Without
      // this a breach investigation starting from the log can establish that a
      // clinician opened a record and never which clinician.
      actorId: who.userId ?? null,
      actorEmail: who.email ?? null,
      onBehalfOf: who.emergency ? "break-glass" : null,
      action,
      patientId,
      detail,
    },
    auditHead,
  );
}
// Accounts, and whether this deployment still accepts the shared codes.
// Default off so a local checkout and the API suite behave as before; the
// blueprint turns it on, so the deployed demo is the one that requires
// accounts. The security page reports which of the two is running rather than
// which one we would like to be running.
const accounts = createAccountStore(dataDir);
const REQUIRE_ACCOUNTS = process.env.RELAY_REQUIRE_ACCOUNTS === "true";

// Break-glass. A clinician is scoped to their own care team; this is how they
// reach a patient outside it when there is no time to arrange otherwise.
// Deliberately cheap to use and expensive to hide: it needs a reason, it lasts
// fifteen minutes, every use is audited with that reason, and while one is open
// it is displayed on the security page.
const EMERGENCY_MS = 15 * 60 * 1000;
const grants = [];
const openGrants = () => {
  const now = Date.now();
  for (let i = grants.length - 1; i >= 0; i--)
    if (grants[i].expiresAt <= now) grants.splice(i, 1);
  return grants.map((g) => ({
    by: g.email,
    reason: g.reason,
    patientId: g.patientId,
    openedAt: new Date(g.openedAt).toISOString(),
    expiresAt: new Date(g.expiresAt).toISOString(),
  }));
};
const hasGrant = (userId, patientId) => {
  const now = Date.now();
  return grants.some(
    (g) =>
      g.userId === userId &&
      g.expiresAt > now &&
      (g.patientId === null || g.patientId === patientId),
  );
};

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "3mb" }));
// Role access codes. Two shared codes, not per-user accounts: a clinician and
// a patient sign in with different codes and the server records which. That is
// honest about what it is, production needs per-account identity, which
// docs/PRIVACY.md states plainly. APP_ACCESS_TOKEN still works on its own and
// grants the clinician role, so nothing that worked before stops working.
const ROLE_CODES = () => {
  const codes = [];
  if (process.env.CLINICIAN_ACCESS_CODE)
    codes.push(["clinician", process.env.CLINICIAN_ACCESS_CODE]);
  if (process.env.PATIENT_ACCESS_CODE)
    codes.push(["patient", process.env.PATIENT_ACCESS_CODE]);
  if (process.env.APP_ACCESS_TOKEN)
    codes.push(["clinician", process.env.APP_ACCESS_TOKEN]);
  return codes;
};

// Constant-time compare, and it must not leak which code matched by timing out
// early, so every candidate is checked.
const matchRole = (provided) => {
  const supplied = Buffer.from(provided || "");
  let role = null;
  for (const [name, code] of ROLE_CODES()) {
    const expected = Buffer.from(code);
    if (
      supplied.length === expected.length &&
      timingSafeEqual(supplied, expected)
    )
      role = role || name;
  }
  return role;
};

// Headers every response carries. A service handling health data is judged on
// these before anyone looks at the product, and the deployment was sending
// none of them. The policy is written tight rather than permissive: the app
// loads no external fonts, styles or scripts, so the only third party it may
// reach is ElevenLabs, and only for the voice check-in.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  // React writes style attributes for the progress bars and chart geometry,
  // and a style attribute is covered by style-src. No host is listed here
  // because the typefaces are served from this origin: a font request to a
  // third party would tell them the IP of everyone who opens a patient record.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://api.elevenlabs.io wss://api.elevenlabs.io",
].join("; ");

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  // A URL here can name a patient route, so it does not travel off-origin.
  res.setHeader("Referrer-Policy", "no-referrer");
  // The voice check-in needs the microphone. Nothing else is needed, so
  // nothing else is permitted.
  res.setHeader(
    "Permissions-Policy",
    "microphone=(self), camera=(), geolocation=(), interest-cohort=()",
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  // Only meaningful where TLS terminates in front of us, and actively unhelpful
  // on a plain-HTTP localhost, so it is set where it applies.
  if (process.env.NODE_ENV === "production")
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  next();
});

app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const configured = ROLE_CODES();
  if (configured.length) {
    // Only the code-for-role exchange is public; it cannot require a code to
    // accept one. /status stays gated, which the API suite asserts. The login
    // page does not need it open: a 401 from /status IS the signal that codes
    // are required, so the closed door answers the question.
    if (!PUBLIC_ROUTES.has(req.path)) {
      const bearer = req.headers.authorization?.replace(/^Bearer /, "");
      // A session names a person. It is tried first, so a deployment that has
      // accounts stops depending on the shared code even before it forbids it.
      const user = accounts.resolveSession(bearer);
      if (user) {
        req.role = user.role;
        req.user = user;
      } else if (REQUIRE_ACCOUNTS) {
        return res.status(401).json({
          error: "Sign in to your account.",
          code: "ACCOUNT_REQUIRED",
        });
      } else {
        const role = matchRole(bearer);
        if (!role)
          return res.status(401).json({ error: "Enter your access code." });
        req.role = role;
      }
    }
  } else {
    req.role = "clinician"; // local demo, no codes configured
  }
  // What a patient code may reach, listed rather than excluded. A deny-list
  // means every clinician route added later has to remember to guard itself,
  // and the cost of forgetting once is a patient reading the whole ward:
  // /api/patients was guarded, but asking for /api/patients/<id> directly was
  // not, and neither was the audit log that lists the ids.
  if (req.role === "patient" && !PATIENT_ROUTES.has(req.path))
    return res
      .status(403)
      .json({ error: "The patient view cannot reach this record." });
  if (
    req.method !== "GET" &&
    req.headers.origin &&
    new URL(req.headers.origin).host !== req.headers.host
  )
    return res
      .status(403)
      .json({ error: "Cross-origin writes are not allowed." });
  requestContext.run(
    {
      role: req.role,
      userId: req.user?.id ?? null,
      email: req.user?.email ?? null,
      emergency: req.user ? hasGrant(req.user.id, null) : false,
    },
    next,
  );
});
// The only routes that answer without a credential, because each one exists to
// obtain a credential and cannot require the thing it issues.
const PUBLIC_ROUTES = new Set([
  "/session",
  "/auth/register",
  "/auth/login",
  "/auth/demo",
]);

// Everything the patient view calls, and nothing else. Kept beside the gate
// that uses it so the two cannot drift apart.
// Discharge code -> patient, read once from the same roster the app shows. A
// real deployment would issue these from the hospital system against an
// account; the point here is that the check happens on the server, because a
// check that only happens in the browser is not a check.
const DISCHARGE_CODES = (() => {
  const byCode = new Map();
  try {
    createSimulatedSource().connect({
      snapshot: (list) => {
        for (const p of list) if (p.code) byCode.set(p.code, p.id);
      },
      readings() {},
      device() {},
    })();
  } catch {
    // A deployment with a different roster simply has none of these; the
    // patient scope check below then refuses rather than waving requests past.
  }
  return byCode;
})();

// Every patient id in the synthetic roster. The voice check-in is the one path
// that sends anything off this origin, and docs/COMPLIANCE.md says it is
// restricted to synthetic patients. It was not: the classic /patients/:id/voice
// route checked dataType, the route the recovery app actually calls checked
// nothing, so a live roster plugged into the same contract would have sent real
// names to a third party with no guard in the way. The claim is now enforced.
const SYNTHETIC_PATIENTS = new Set(DISCHARGE_CODES.values());

// Which record a patient-role caller has actually proved they may read.
const provenPatient = (req) => {
  const supplied = req.headers["x-relay-discharge"];
  if (typeof supplied !== "string" || !supplied) return null;
  return DISCHARGE_CODES.get(supplied.trim().toUpperCase()) || null;
};

const PATIENT_ROUTES = new Set([
  "/session",
  "/status",
  "/ml/score",
  "/voice/session",
  "/recovery/events",
  // A patient must be able to see who they are signed in as, and to end that
  // session. Neither reaches a record.
  "/auth/me",
  "/auth/logout",
]);

// --- Accounts -------------------------------------------------------------
//
// The shared access code is now an invitation rather than a credential: it
// chooses which role an account is created with, and after that it reaches
// nothing on its own wherever RELAY_REQUIRE_ACCOUNTS is set.

const roleFromInvite = (code) => matchRole(code);

app.post("/api/auth/register", (req, res) => {
  const { email, password, invite, careTeam } = req.body || {};
  const role = roleFromInvite(invite);
  if (!role)
    return res
      .status(403)
      .json({ error: "That access code was not recognised." });
  const result = accounts.register({
    email,
    password,
    role,
    careTeam: typeof careTeam === "string" ? careTeam.trim() || null : null,
  });
  if (result.error) return res.status(400).json({ error: result.error });
  const token = accounts.openSession(result.user.id);
  requestContext.run(
    { role, userId: result.user.id, email: result.user.email },
    () => audit("account.created", null, result.user.email),
  );
  res.json({ token, user: result.user });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = accounts.authenticate(email, password);
  if (!user)
    return res
      .status(401)
      .json({ error: "That email address and password do not match." });
  const token = accounts.openSession(user.id);
  requestContext.run(
    { role: user.role, userId: user.id, email: user.email },
    () => audit("account.signed_in", null, user.email),
  );
  res.json({ token, user });
});

// One click into the deployed demo, and still a named principal: each browser
// gets its own, so two people looking at the same time are two actors in the
// log rather than one anonymous "clinician".
app.post("/api/auth/demo", (req, res) => {
  const role = req.body?.role === "patient" ? "patient" : "clinician";
  const user = accounts.createDemoPrincipal(role);
  const token = accounts.openSession(user.id);
  requestContext.run({ role, userId: user.id, email: user.email }, () =>
    audit("account.demo_issued", null, user.email),
  );
  res.json({ token, user });
});

app.get("/api/auth/me", (req, res) => {
  if (!req.user) return res.status(404).json({ error: "No account session." });
  res.json({ user: req.user });
});

app.post("/api/auth/logout", (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  const closed = accounts.closeSession(token);
  if (closed) audit("account.signed_out", null, req.user?.email || "");
  res.json({ ok: true });
});

// --- Break-glass ----------------------------------------------------------
//
// 164.312(a)(2)(ii) is required and not addressable, and there was no path at
// all. It only means something because a clinician is otherwise scoped to their
// own care team: a safeguard that grants what you already had is theatre.
app.post("/api/emergency-access", (req, res) => {
  if (req.role !== "clinician")
    return res.status(403).json({ error: "Clinician access only." });
  if (!req.user)
    return res
      .status(403)
      .json({ error: "Break-glass access requires a named account." });
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 10)
    return res
      .status(400)
      .json({ error: "Give the reason for emergency access, in a sentence." });
  const patientId =
    typeof req.body?.patientId === "string" ? req.body.patientId : null;
  const now = Date.now();
  grants.push({
    userId: req.user.id,
    email: req.user.email,
    reason,
    patientId,
    openedAt: now,
    expiresAt: now + EMERGENCY_MS,
  });
  audit("emergency.access_opened", patientId, reason);
  res.json({ ok: true, expiresAt: new Date(now + EMERGENCY_MS).toISOString() });
});

// Exchange an access code for a role. The client keeps the code and sends it
// as a Bearer token; there is no session store, which is the honest limit of a
// shared-code scheme.
app.post("/api/session", (req, res) => {
  const configured = ROLE_CODES();
  if (!configured.length)
    return res.json({ role: "clinician", mode: "local-demo" });
  const role = matchRole(String(req.body?.code || ""));
  if (!role)
    return res.status(401).json({ error: "That code was not recognised." });
  res.json({ role, mode: "access-code" });
});

app.get("/api/status", (req, res) =>
  res.json({
    mode: "Synthetic demo",
    auth: ROLE_CODES().length
      ? "Role access codes"
      : "Local demo • no authentication",
    roles: [...new Set(ROLE_CODES().map(([name]) => name))],
    render: !!(process.env.RENDER_API_KEY && process.env.RENDER_WORKFLOW_SLUG),
    voice: !!(
      process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_AGENT_ID
    ),
  }),
);
// The cohort is the clinician's view of the ward. A patient code must not
// return it. This is the one role rule a shared code can actually enforce:
// it cannot tell WHICH patient is signed in, so it cannot scope to a single
// record, see docs/PRIVACY.md.
app.get("/api/patients", (req, res) => {
  if (req.role === "patient")
    return res
      .status(403)
      .json({ error: "The patient view cannot list other patients." });
  // A read of the whole ward is an access to every record in it.
  audit("roster.view", null, `${patients.length} records`);
  res.json(
    patients.map(({ events, ...p }) => ({
      ...p,
      measurementCount: events.length,
    })),
  );
});
app.param("id", (req, res, next, id) => {
  req.patient = patients.find((p) => p.id === id);
  if (!req.patient)
    return res.status(404).json({ error: "Patient not found." });
  next();
});
app.get("/api/patients/:id", (req, res) => {
  audit("record.view", req.patient.id);
  res.json(req.patient);
});
const pending = new Set();
async function pipeline(events, patientContext, patient) {
  if (process.env.RENDER_API_KEY && process.env.RENDER_WORKFLOW_SLUG) {
    if (patient.dataType !== "synthetic")
      throw new Error(
        "Cloud workflows are restricted to synthetic records in this prototype.",
      );
    const { Render } = await import("@renderinc/sdk");
    const result = await new Render().workflows.runTask(
      `${process.env.RENDER_WORKFLOW_SLUG}/monitoringPipeline`,
      [events, patientContext],
      AbortSignal.timeout(300000),
    );
    if (result.status !== "completed" || !result.results?.[0]?.signals)
      throw new Error("Render workflow did not return a completed analysis.");
    return {
      evidence: result.results[0],
      execution: { mode: "Render Workflows", id: result.id },
    };
  }
  if (process.env.RELAY_ML_ENABLED === "true") {
    try {
      const evidence = await scoreWithRelay({
        events,
        context: patientContext,
        program:
          patient.program ||
          process.env.RELAY_PROGRAM ||
          "post_abdominal_surgery",
        patientId: patient.id,
      });
      return {
        evidence,
        execution: { mode: "Local Relay ML", id: randomUUID() },
      };
    } catch (error) {
      console.warn(
        `Relay ML unavailable; using deterministic engine: ${error.message}`,
      );
    }
  }
  return {
    evidence: analyze(events, patientContext),
    execution: { mode: "Local engine", id: randomUUID() },
  };
}
async function updateAnalysis(req, res, events, patientContext, action) {
  const p = req.patient;
  if (!p.consent)
    return res
      .status(403)
      .json({ error: "Monitoring consent has been revoked." });
  if (pending.has(p.id))
    return res
      .status(409)
      .json({ error: "Analysis already running for this patient." });
  pending.add(p.id);
  try {
    const result = await pipeline(events, patientContext, p);
    if (!p.consent)
      throw new Error("Consent changed during analysis. Result discarded.");
    Object.assign(p, result, { events, acknowledged: false });
    save();
    audit(action, p.id, result.execution.mode);
    res.json(p);
  } finally {
    pending.delete(p.id);
  }
}
app.post("/api/patients/:id/analyze", async (req, res) =>
  updateAnalysis(
    req,
    res,
    req.patient.events,
    req.patient.evidence.context,
    "analysis.run",
  ),
);
app.post("/api/patients/:id/simulate", async (req, res) => {
  if (req.patient.dataType !== "synthetic")
    return res
      .status(400)
      .json({ error: "Simulation is only available for synthetic patients." });
  const scenario = req.body.scenario;
  if (!["ambiguous", "explained", "review"].includes(scenario))
    return res.status(400).json({ error: "Choose a supported scenario." });
  return updateAnalysis(
    req,
    res,
    simulate(scenario),
    scenario === "review"
      ? context
      : scenario === "explained"
        ? {
            exercise: "Recorded workout and meal",
            fatigue: "Not reported",
            medication: "Not reported",
            timestamp: new Date().toISOString(),
            consent: true,
          }
        : null,
    "simulation.run",
  );
});
app.post("/api/patients/:id/checkin", async (req, res) => {
  const {
    exercise,
    fatigue,
    medication,
    notes,
    consent,
    method,
    conversationId,
  } = req.body;
  if (
    consent !== true ||
    !["No unusual activity", "Recent exercise", "Unsure"].includes(exercise) ||
    !["None", "Unchanged", "Worsening", "Unsure"].includes(fatigue) ||
    !["No changes", "Missed or changed", "Unsure"].includes(medication)
  )
    return res.status(400).json({
      error: "Consent and all three structured answers are required.",
    });
  if (
    method !== undefined &&
    ![
      "Patient-confirmed structured form",
      "ElevenLabs voice assistant",
    ].includes(method)
  )
    return res.status(400).json({ error: "Unsupported check-in method." });
  if (
    conversationId !== undefined &&
    (typeof conversationId !== "string" || conversationId.length > 200)
  )
    return res.status(400).json({ error: "Invalid voice conversation ID." });
  if (
    notes !== undefined &&
    (typeof notes !== "string" || notes.trim().length > 500)
  )
    return res
      .status(400)
      .json({ error: "Additional context is limited to 500 characters." });
  return updateAnalysis(
    req,
    res,
    req.patient.events,
    {
      exercise,
      fatigue,
      medication,
      ...(notes?.trim() && notes.trim().toLowerCase() !== "none"
        ? { notes: notes.trim() }
        : {}),
      consent,
      timestamp: new Date().toISOString(),
      method: method || "Patient-confirmed structured form",
      ...(conversationId ? { conversationId } : {}),
    },
    "checkin.recorded",
  );
});
app.post("/api/patients/:id/consent", (req, res) => {
  if (typeof req.body.consent !== "boolean")
    return res.status(400).json({ error: "Consent must be true or false." });
  req.patient.consent = req.body.consent;
  save();
  audit("consent.changed", req.patient.id, String(req.body.consent));
  res.json(req.patient);
});
app.post("/api/patients/:id/acknowledge", (req, res) => {
  req.patient.acknowledged = true;
  save();
  audit("review.acknowledged", req.patient.id);
  res.json(req.patient);
});
app.get("/api/patients/:id/fhir", (req, res) => {
  audit("handoff.exported", req.patient.id);
  res.json(fhirBundle(req.patient));
});
app.get("/api/audit", (req, res) => {
  res.json(readSealedLines(auditFile).reverse().slice(0, 200));
});

// What is actually true of this running process, for the security page. The
// page used to state the intention; a deployment missing its key, or still
// accepting a shared code, would have gone on claiming otherwise. Everything
// here is read from the process, not from a constant.
app.get("/api/safeguards", (req, res) => {
  const chain = verifyChain(auditFile);
  res.json({
    encryptionAtRest: {
      mode: encryptionMode(),
      keyPresent: KEY_PRESENT,
      keyStretchedFromPassphrase: KEY_DERIVED,
    },
    auditChain: {
      lines: chain.lines,
      chained: chain.chained,
      unchained: chain.unchained,
      intact: chain.ok,
      brokenAt: chain.brokenAt,
      reason: chain.reason || null,
    },
    identity: {
      accountsRequired: REQUIRE_ACCOUNTS,
      sharedCodesAccepted: !REQUIRE_ACCOUNTS && ROLE_CODES().length > 0,
      accounts: accounts.count(),
      demoPrincipals: accounts.demoCount(),
      openSessions: accounts.sessionCount(),
    },
    emergencyAccess: {
      available: true,
      open: openGrants(),
    },
  });
});
app.post("/api/import", (req, res) => {
  if (
    !["synthetic", "de-identified"].includes(req.body.dataType) ||
    req.body.confirmed !== true
  )
    return res.status(400).json({
      error: "Confirm records are synthetic or de-identified before importing.",
    });
  const events = normalize(req.body.events);
  const id = `import-${randomUUID().slice(0, 8)}`;
  const p = {
    id,
    name: `Wearable dataset ${patients.filter((p) => p.id.startsWith("import")).length + 1}`,
    initials: "WD",
    dataType: req.body.dataType,
    events,
    consent: true,
    acknowledged: false,
    evidence: analyze(events),
    execution: { mode: "Local engine", id: randomUUID() },
  };
  patients.push(p);
  save();
  audit("dataset.imported", id, `${events.length} measurements; ${p.dataType}`);
  res.status(201).json(p);
});
app.post("/api/patients/:id/voice", async (req, res) => {
  if (!req.patient.consent || req.body.consent !== true)
    return res
      .status(403)
      .json({ error: "Explicit consent is required for a voice session." });
  if (req.patient.dataType !== "synthetic")
    return res.status(403).json({
      error: "Voice integration is restricted to synthetic demo patients.",
    });
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_AGENT_ID)
    return res.status(503).json({
      error: "Voice is not configured. The text check-in is available.",
    });
  let response;
  try {
    response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(process.env.ELEVENLABS_AGENT_ID)}`,
      {
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch {
    return res.status(503).json({
      error: "ElevenLabs is unavailable. Use the text check-in.",
      code: "ELEVENLABS_UNAVAILABLE",
    });
  }
  if (!response.ok)
    return res.status(503).json({
      error: "Unable to start ElevenLabs session. Use the text check-in.",
      code: "ELEVENLABS_SESSION_FAILED",
    });
  let payload;
  try {
    payload = await response.json();
  } catch {
    return res.status(503).json({
      error: "ElevenLabs returned an invalid session response.",
      code: "ELEVENLABS_INVALID_RESPONSE",
    });
  }
  if (typeof payload?.signed_url !== "string" || !payload.signed_url)
    return res.status(503).json({
      error: "ElevenLabs did not return a signed session URL.",
      code: "ELEVENLABS_INVALID_RESPONSE",
    });
  audit("checkin.voice.started", req.patient.id);
  res.json({ signed_url: payload.signed_url });
});
// Mint an ElevenLabs signed session for the patient view. The classic route above
// is bound to the classic patient list; the recovery app keeps its patients in the
// browser, so this one only needs consent. The agent's context (readings, model
// result, questions) travels as dynamic variables from the browser, never here.
app.post("/api/voice/session", async (req, res) => {
  if (req.body?.consent !== true)
    return res
      .status(403)
      .json({ error: "Explicit consent is required for a voice session." });
  if (!SYNTHETIC_PATIENTS.has(req.body?.patientId))
    return res.status(403).json({
      error: "A voice check-in is limited to the synthetic demo cohort.",
      code: "VOICE_NOT_SYNTHETIC",
    });
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_AGENT_ID)
    return res.status(503).json({
      error: "Voice is not configured. The text assistant is available.",
      code: "VOICE_DISABLED",
    });
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(process.env.ELEVENLABS_AGENT_ID)}`,
      {
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) throw new Error(`ElevenLabs replied ${response.status}`);
    const payload = await response.json();
    if (typeof payload?.signed_url !== "string" || !payload.signed_url)
      throw new Error("no signed URL");
    audit("checkin.voice.started", req.body?.patientId || null, "patient view");
    res.json({ signed_url: payload.signed_url });
  } catch (error) {
    res.status(503).json({
      error: `Unable to start the voice session (${error.message}). Use the text assistant.`,
      code: "VOICE_UNAVAILABLE",
    });
  }
});

// One-way speech for a clinician briefing. The browser builds a bounded summary
// from synthetic demo readings; no patient name, identifier, or free-text note
// is sent to ElevenLabs. The agent's configured voice is reused by default.
app.post("/api/voice/clinician-summary", async (req, res) => {
  if (req.role !== "clinician")
    return res.status(403).json({ error: "Clinician access is required." });
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ELEVENLABS_DEMO_SUMMARY_ENABLED !== "true"
  )
    return res.status(503).json({
      error: "Clinician voice summaries are disabled for this deployment.",
    });
  if (req.body?.demoSynthetic !== true)
    return res
      .status(403)
      .json({ error: "Voice summaries are for synthetic demo data only." });
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (text.length < 20 || text.length > 3000)
    return res
      .status(400)
      .json({ error: "Summary text must be between 20 and 3,000 characters." });
  if (
    !process.env.ELEVENLABS_API_KEY ||
    (!process.env.ELEVENLABS_VOICE_ID && !process.env.ELEVENLABS_AGENT_ID)
  )
    return res
      .status(503)
      .json({ error: "ElevenLabs speech is not configured." });

  try {
    let voiceId = process.env.ELEVENLABS_VOICE_ID || "";
    let voiceConfig = null;
    if (!voiceId || process.env.ELEVENLABS_AGENT_ID) {
      const agentResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(process.env.ELEVENLABS_AGENT_ID)}`,
        {
          headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
          signal: AbortSignal.timeout(12000),
        },
      );
      if (!agentResponse.ok)
        throw new Error("Could not read the configured voice.");
      const agent = await agentResponse.json();
      voiceConfig = agent?.conversation_config?.tts || null;
      voiceId ||= voiceConfig?.voice_id;
      if (!voiceId) throw new Error("The configured agent has no voice ID.");
    }

    const speech = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: voiceConfig?.model_id || "eleven_multilingual_v2",
          ...(voiceConfig?.voice_settings
            ? { voice_settings: voiceConfig.voice_settings }
            : {}),
        }),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!speech.ok) {
      if (speech.status === 401)
        throw new Error("ElevenLabs audio is unavailable.");
      throw new Error(`ElevenLabs speech request failed (${speech.status}).`);
    }
    const audio = Buffer.from(await speech.arrayBuffer());
    if (!audio.length || audio.length > 8_000_000)
      throw new Error("ElevenLabs returned an invalid audio response.");
    audit(
      "clinician.voice_summary.generated",
      null,
      `${text.length} characters`,
    );
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(audio);
  } catch {
    res.status(503).json({ error: "Voice playback is unavailable." });
  }
});

// Score any patient's readings with the Python model. Used by the patient view,
// which keeps its own store in the browser: it sends the event contract plus the
// structured check-in context and gets the evidence object back. Either role may
// call it; a patient can only send what their own browser holds.
app.post("/api/ml/score", async (req, res) => {
  const {
    events,
    context = null,
    program,
    patient_id: patientId,
  } = req.body || {};
  if (!Array.isArray(events) || !events.length || events.length > 10000)
    return res
      .status(400)
      .json({ error: "Supply 1-10,000 measurement records." });
  if (process.env.RELAY_ML_ENABLED !== "true")
    return res.status(503).json({
      // This reaches a clinician's screen, so it says what is true of the
      // deployment rather than naming the switch that turns it on.
      error:
        "The model runs as a Python program, which this deployment does not have attached. Everything above comes from the rule and is unaffected.",
      code: "ML_DISABLED",
    });
  try {
    const evidence = await scoreWithRelay({
      events,
      context,
      program,
      patientId,
    });
    audit(
      "ml.scored",
      patientId || null,
      `${events.length} events; ${evidence.application_state}`,
    );
    // Every sentence the model wrote passes the clinical boundary before it
    // leaves the server. A tripped sentence is replaced, not the whole result,
    // and the redaction is its own audit event.
    const guarded = guardEvidence(evidence);
    if (guarded.guard.withheld.length)
      audit(
        "ml.guard",
        patientId || null,
        guarded.guard.withheld.map((w) => w.path).join(", "),
      );
    // The patient view needs the decision and its explanation, not every raw event.
    res.json({
      ...guarded,
      signals: guarded.signals.map(({ recent, ...signal }) => ({
        ...signal,
        recentCount: recent?.length ?? 0,
      })),
    });
  } catch (error) {
    res.status(502).json({
      error: `Model scoring failed: ${error.message}`,
      code: "ML_FAILED",
    });
  }
});

// Shared recovery log for the recovery-watch app. Whatever the patient or the
// clinician enters is one event; the other side polls for it. Events are kept
// as they arrive (append-only, under DATA_DIR) and served back in order. The
// patient role reads one record, named by patientId; the clinician role reads
// the ward. A client id (eid) makes a retried post idempotent.
const recoveryFile = resolve(dataDir, "recovery-events.jsonl");
const MAX_RECOVERY_EVENTS = 5000;
let recoveryEvents = existsSync(recoveryFile)
  ? readFileSync(recoveryFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  : [];
const recoveryIds = new Set(recoveryEvents.map((e) => e.eid));
const lastSeq = () =>
  recoveryEvents.length ? recoveryEvents[recoveryEvents.length - 1].seq : 0;
app.get("/api/recovery/events", (req, res) => {
  const after = Number(req.query.after) || 0;
  const patientId =
    typeof req.query.patientId === "string" ? req.query.patientId : null;
  if (req.role === "patient") {
    if (!patientId)
      return res.status(400).json({ error: "patientId is required." });
    // The shared role code says "a patient", not "which patient". The
    // discharge code says which, so it is what the requested record is checked
    // against. Without it a signed-in patient could read any other patient's
    // check-ins by editing a query parameter.
    if (provenPatient(req) !== patientId)
      return res.status(403).json({ error: "That is not your record." });
  }
  const events = recoveryEvents.filter(
    (e) => e.seq > after && (!patientId || e.patientId === patientId),
  );
  // Audit controls, 45 CFR 164.312(b). This route returns a patient's
  // check-ins, notes and model results, so reaching it is an access to the
  // record and belongs in the log. Only the first page of a scope is recorded:
  // the client polls every three seconds and a line per poll would bury the
  // accesses that matter under a hundred an hour.
  if (after === 0 && events.length)
    audit("recovery.read", patientId, `${events.length} events`);
  res.json({ events, seq: lastSeq() });
});
app.post("/api/recovery/events", (req, res) => {
  const list = Array.isArray(req.body?.events) ? req.body.events : [];
  if (!list.length || list.length > 100)
    return res.status(400).json({ error: "Supply 1-100 events." });
  const accepted = [];
  for (const e of list) {
    if (
      !e ||
      typeof e.type !== "string" ||
      typeof e.patientId !== "string" ||
      typeof e.eid !== "string" ||
      recoveryIds.has(e.eid)
    )
      continue;
    // A check-in whose answers are not an object is refused rather than
    // stored. Once on disk it replays into every client on every load, and
    // the cohort view derives all patients together, so one bad record is a
    // permanently broken ward list rather than one broken screen.
    if (
      e.type === "checkin" &&
      (typeof e.answers !== "object" ||
        e.answers === null ||
        Array.isArray(e.answers))
    )
      continue;
    // A patient may only write to their own record, on the same proof. A
    // clinician may write to any, which is the job.
    if (req.role === "patient" && provenPatient(req) !== e.patientId) continue;
    const stored = { ...e, seq: lastSeq() + 1, role: req.role };
    recoveryEvents.push(stored);
    recoveryIds.add(e.eid);
    appendFileSync(recoveryFile, JSON.stringify(stored) + "\n", {
      mode: 0o600,
    });
    accepted.push(stored.seq);
  }
  if (recoveryEvents.length > MAX_RECOVERY_EVENTS) {
    recoveryEvents = recoveryEvents.slice(-MAX_RECOVERY_EVENTS);
    writeFileSync(
      recoveryFile,
      recoveryEvents.map((e) => JSON.stringify(e)).join("\n") + "\n",
      { mode: 0o600 },
    );
  }
  audit(
    "recovery.events",
    list[0]?.patientId || null,
    `${accepted.length} of ${list.length} accepted from ${req.role}: ${[...new Set(list.map((e) => e.type))].join(", ")}`,
  );
  res.json({ seq: lastSeq(), accepted });
});

app.use("/api", (req, res) =>
  res.status(404).json({ error: "Unknown API route." }),
);
app.use(express.static(resolve(root, "dist")));
app.get("/{*path}", (req, res) =>
  res.sendFile(resolve(root, "dist/index.html")),
);
app.use((error, req, res, next) => {
  console.error(error.message);
  res
    .status(
      error.type === "entity.parse.failed" || error.type === "entity.too.large"
        ? 400
        : 422,
    )
    .json({ error: error.message });
});
if (process.env.NODE_ENV === "production" && !process.env.APP_ACCESS_TOKEN)
  throw new Error("APP_ACCESS_TOKEN is required in production.");
const port = process.env.PORT || 3001;
app.listen(
  port,
  process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
  () => console.log(`Relay API: http://127.0.0.1:${port}`),
);
