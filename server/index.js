import express from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";
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
import { scoreWithVesper } from "./vesper.js";
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
let patients = existsSync(stateFile)
  ? JSON.parse(readFileSync(stateFile, "utf8"))
  : seeded();
function save() {
  const temp = stateFile + ".tmp";
  writeFileSync(temp, JSON.stringify(patients), { mode: 0o600 });
  renameSync(temp, stateFile);
}
function audit(action, patientId = null, detail = "") {
  appendFileSync(
    resolve(dataDir, "audit.jsonl"),
    JSON.stringify({
      id: randomUUID(),
      at: new Date().toISOString(),
      actor: "demo-provider",
      action,
      patientId,
      detail,
    }) + "\n",
    { mode: 0o600 },
  );
}
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "3mb" }));
// Role access codes. Two shared codes, not per-user accounts: a clinician and
// a patient sign in with different codes and the server records which. That is
// honest about what it is — production needs per-account identity, which
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

app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const configured = ROLE_CODES();
  if (configured.length) {
    // Only the code-for-role exchange is public; it cannot require a code to
    // accept one. /status stays gated, which the API suite asserts. The login
    // page does not need it open: a 401 from /status IS the signal that codes
    // are required, so the closed door answers the question.
    if (req.path !== "/session") {
      const role = matchRole(
        req.headers.authorization?.replace(/^Bearer /, ""),
      );
      if (!role)
        return res.status(401).json({ error: "Enter your access code." });
      req.role = role;
    }
  } else {
    req.role = "clinician"; // local demo, no codes configured
  }
  if (
    req.method !== "GET" &&
    req.headers.origin &&
    new URL(req.headers.origin).host !== req.headers.host
  )
    return res
      .status(403)
      .json({ error: "Cross-origin writes are not allowed." });
  next();
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
// record — see docs/PRIVACY.md.
app.get("/api/patients", (req, res) => {
  if (req.role === "patient")
    return res
      .status(403)
      .json({ error: "The patient view cannot list other patients." });
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
  if (process.env.VESPER_ML_ENABLED === "true") {
    try {
      const evidence = await scoreWithVesper({
        events,
        context: patientContext,
        program:
          patient.program ||
          process.env.VESPER_PROGRAM ||
          "post_abdominal_surgery",
        patientId: patient.id,
      });
      return {
        evidence,
        execution: { mode: "Local Vesper ML", id: randomUUID() },
      };
    } catch (error) {
      console.warn(
        `Vesper ML unavailable; using deterministic engine: ${error.message}`,
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
  const file = resolve(dataDir, "audit.jsonl");
  res.json(
    existsSync(file)
      ? readFileSync(file, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((x) => JSON.parse(x))
          .reverse()
          .slice(0, 200)
      : [],
  );
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
let cachedSummaryVoiceId = "";
app.post("/api/voice/clinician-summary", async (req, res) => {
  if (req.role !== "clinician")
    return res.status(403).json({ error: "Clinician access is required." });
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ELEVENLABS_DEMO_SUMMARY_ENABLED !== "true"
  )
    return res.status(503).json({ error: "Clinician voice summaries are disabled for this deployment." });
  if (req.body?.demoSynthetic !== true)
    return res.status(403).json({ error: "Voice summaries are for synthetic demo data only." });
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (text.length < 20 || text.length > 3000)
    return res.status(400).json({ error: "Summary text must be between 20 and 3,000 characters." });
  if (!process.env.ELEVENLABS_API_KEY || (!process.env.ELEVENLABS_VOICE_ID && !process.env.ELEVENLABS_AGENT_ID))
    return res.status(503).json({ error: "ElevenLabs speech is not configured." });

  try {
    let voiceId = process.env.ELEVENLABS_VOICE_ID || cachedSummaryVoiceId;
    if (!voiceId) {
      const agentResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(process.env.ELEVENLABS_AGENT_ID)}`,
        {
          headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
          signal: AbortSignal.timeout(12000),
        },
      );
      if (!agentResponse.ok) throw new Error("Could not read the configured voice.");
      const agent = await agentResponse.json();
      voiceId = agent?.conversation_config?.tts?.voice_id;
      if (!voiceId) throw new Error("The configured agent has no voice ID.");
      cachedSummaryVoiceId = voiceId;
    }

    const speech = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!speech.ok) {
      if (speech.status === 401)
        throw new Error("The ElevenLabs API key needs the text_to_speech permission.");
      throw new Error(`ElevenLabs speech request failed (${speech.status}).`);
    }
    const audio = Buffer.from(await speech.arrayBuffer());
    if (!audio.length || audio.length > 8_000_000)
      throw new Error("ElevenLabs returned an invalid audio response.");
    audit("clinician.voice_summary.generated", null, `${text.length} characters`);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(audio);
  } catch (error) {
    res.status(503).json({ error: error.message || "Unable to prepare voice summary." });
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
  if (process.env.VESPER_ML_ENABLED !== "true")
    return res.status(503).json({
      // This reaches a clinician's screen, so it says what is true of the
      // deployment rather than naming the switch that turns it on.
      error:
        "The model runs as a Python program, which this deployment does not have attached. Everything above comes from the rule and is unaffected.",
      code: "ML_DISABLED",
    });
  try {
    const evidence = await scoreWithVesper({
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
