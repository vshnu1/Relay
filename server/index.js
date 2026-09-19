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
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const token = process.env.APP_ACCESS_TOKEN;
  if (token) {
    const provided = Buffer.from(
      req.headers.authorization?.replace(/^Bearer /, "") || "",
    );
    const expected = Buffer.from(token);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    )
      return res
        .status(401)
        .json({ error: "Enter the workspace access token." });
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
app.get("/api/status", (req, res) =>
  res.json({
    mode: "Synthetic demo",
    auth: process.env.APP_ACCESS_TOKEN
      ? "Shared access token"
      : "Local demo • no authentication",
    render: !!(process.env.RENDER_API_KEY && process.env.RENDER_WORKFLOW_SLUG),
    voice: !!(
      process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_AGENT_ID
    ),
  }),
);
app.get("/api/patients", (req, res) =>
  res.json(
    patients.map(({ events, ...p }) => ({
      ...p,
      measurementCount: events.length,
    })),
  ),
);
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
