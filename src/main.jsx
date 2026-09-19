import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  AudioLines,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Database,
  Download,
  FileJson,
  Heart,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Users,
  Watch,
  X,
} from "lucide-react";
import { METRICS } from "../shared/engine.js";
import "./styles.css";
async function api(path, body) {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionStorage.getItem("relay-token")
        ? { Authorization: `Bearer ${sessionStorage.getItem("relay-token")}` }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("relay-auth"));
    throw new Error(result.error || "Request failed.");
  }
  return result;
}
const date = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No data";
const states = {
  context: "Context needed",
  review: "Ready for review",
  quiet: "No review trigger",
};
function Badge({ state, children }) {
  return (
    <span className={`badge ${state || ""}`}>
      <span className="dot" />
      {children || states[state]}
    </span>
  );
}
function Chart({ signal, events, windowHours = 36 }) {
  const points = events.filter((e) => e.metric === signal.metric).slice(-21);
  if (points.length < 2)
    return (
      <div className="empty-chart">
        Not enough measurements to draw a trend.
      </div>
    );
  const vals = points.map((e) => e.value),
    baseline = signal.baseline.mean;
  const low = Math.min(...vals, baseline ?? Infinity) * 0.94,
    high = Math.max(...vals, baseline ?? -Infinity) * 1.06;
  const start = Date.parse(points[0].timestamp),
    end = Date.parse(points.at(-1).timestamp);
  const x = (t) => 8 + ((Date.parse(t) - start) / (end - start || 1)) * 684;
  const y = (v) => 80 - ((v - low) / (high - low || 1)) * 64;
  return (
    <svg
      viewBox="0 0 700 98"
      role="img"
      aria-label={`${signal.label} timeline. Baseline ${baseline?.toFixed(1) ?? "unavailable"} ${signal.unit}.`}
    >
      <rect
        x={Math.max(0, x(new Date(end - windowHours * 3600000).toISOString()))}
        y="0"
        width="700"
        height="95"
        fill={signal.flagged ? "#faf0e7" : "#f2f5f3"}
      />
      {baseline !== null && (
        <>
          <line
            x1="0"
            x2="700"
            y1={y(baseline)}
            y2={y(baseline)}
            stroke="#b8c2bd"
            strokeDasharray="4 5"
          />
          <text
            x="5"
            y={Math.max(10, y(baseline) - 5)}
            fill="#96a29c"
            fontSize="9"
          >
            BASELINE {baseline.toFixed(1)}
          </text>
        </>
      )}
      <polyline
        points={points.map((e) => `${x(e.timestamp)},${y(e.value)}`).join(" ")}
        fill="none"
        stroke={signal.color}
        strokeWidth="2.3"
        strokeLinejoin="round"
      />
      {points.map((e) => (
        <circle
          key={e.id}
          cx={x(e.timestamp)}
          cy={y(e.value)}
          r="3"
          fill={signal.color}
        >
          <title>{`${date(e.timestamp)}: ${e.value} ${signal.unit} · ${e.source} · ${e.id}`}</title>
        </circle>
      ))}
    </svg>
  );
}
function App() {
  const [patients, setPatients] = useState([]),
    [selected, setSelected] = useState("demo-01"),
    [patient, setPatient] = useState(null),
    [status, setStatus] = useState(null);
  const [page, setPage] = useState("workspace"),
    [tab, setTab] = useState("All data"),
    [query, setQuery] = useState(""),
    [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [audit, setAudit] = useState([]),
    [bundle, setBundle] = useState(null),
    [scenario, setScenario] = useState("ambiguous");
  const [consent, setConsent] = useState(false),
    [answers, setAnswers] = useState({
      exercise: "",
      fatigue: "",
      medication: "",
    }),
    [voice, setVoice] = useState(null),
    [voiceStatus, setVoiceStatus] = useState(""),
    [auth, setAuth] = useState(false),
    [token, setToken] = useState("");
  const voiceRef = useRef(null);
  const load = async () => {
    const [list, config] = await Promise.all([
      api("/patients"),
      api("/status"),
    ]);
    setPatients(list);
    setStatus(config);
  };
  useEffect(() => {
    const handler = () => setAuth(true);
    window.addEventListener("relay-auth", handler);
    load().catch((e) => setError(e.message));
    return () => {
      window.removeEventListener("relay-auth", handler);
      voiceRef.current?.endSession();
    };
  }, []);
  useEffect(() => {
    let active = true;
    setPatient(null);
    api(`/patients/${selected}`)
      .then((p) => {
        if (active) setPatient(p);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [selected]);
  async function run(fn) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function change(action, body) {
    const p = await api(`/patients/${selected}/${action}`, body);
    setPatient(p);
    await load();
    return p;
  }
  async function openAudit() {
    setPage("audit");
    setAudit(await api("/audit"));
  }
  async function openFHIR() {
    setBundle(await api(`/patients/${selected}/fhir`));
    setModal("fhir");
  }
  function download(value, filename) {
    const u = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = u;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(u);
  }
  async function closeModal() {
    if (voiceRef.current) await voiceRef.current.endSession();
    voiceRef.current = null;
    setVoice(null);
    setVoiceStatus("");
    setModal(null);
  }
  async function startVoice() {
    const { signed_url } = await api(`/patients/${selected}/voice`, {
      consent,
    });
    const { Conversation } = await import("@elevenlabs/client");
    voiceRef.current = await Conversation.startSession({
      signedUrl: signed_url,
      connectionType: "websocket",
      onStatusChange: ({ status }) => setVoiceStatus(status),
      onError: () =>
        setError(
          "Voice session interrupted. Complete the structured text check-in below.",
        ),
      clientTools: {
        record_checkin_response: async (parameters) => {
          setAnswers((a) => ({
            ...a,
            ...Object.fromEntries(
              Object.entries(parameters).filter(([k]) =>
                ["exercise", "fatigue", "medication"].includes(k),
              ),
            ),
          }));
          return "Answers drafted. Ask the patient to verify and submit the form.";
        },
      },
    });
    setVoice(true);
  }
  const evidence = patient?.evidence;
  const queue = patients.filter(
    (p) => p.evidence.state !== "quiet" && !p.acknowledged,
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Relay home">
          <div className="brand-mark">
            <Activity size={25} />
          </div>
          relay<span>®</span>
        </a>
        <div className="workspace-label">CARE WORKSPACE</div>
        <button
          className={page === "workspace" ? "nav active" : "nav"}
          onClick={() => setPage("workspace")}
        >
          <LayoutDashboard size={18} /> Monitoring{" "}
          <span className="nav-count">{queue.length}</span>
        </button>
        <button
          className={page === "patients" ? "nav active" : "nav"}
          onClick={() => setPage("patients")}
        >
          <Users size={18} /> Patients
        </button>
        <button
          className={page === "sources" ? "nav active" : "nav"}
          onClick={() => setPage("sources")}
        >
          <Database size={18} /> Data connections
        </button>
        <button
          className={page === "audit" ? "nav active" : "nav"}
          onClick={() => run(openAudit)}
        >
          <ClipboardList size={18} /> Audit trail
        </button>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <ShieldCheck size={19} />
            <strong>Built for the demo</strong>
            <p>
              Synthetic records.
              <br />
              Human clinical judgment.
            </p>
            <span>
              Bay Hacks 2026 <ArrowUpRight size={12} />
            </span>
          </div>
          <button className="profile" onClick={() => setModal("access")}>
            <div className="avatar small">DP</div>
            <div>
              <strong>Demo provider</strong>
              <span>Workspace access</span>
            </div>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />{" "}
            <strong>
              {page === "workspace"
                ? "Monitoring"
                : page === "sources"
                  ? "Data connections"
                  : page === "audit"
                    ? "Audit trail"
                    : "Patients"}
            </strong>
          </div>
          <div className="header-right">
            <span className="demo-label">
              <span className="dot" /> Prototype environment
            </span>
            <button
              className="icon-button"
              aria-label="Workspace information"
              onClick={() => setModal("access")}
            >
              <ShieldCheck size={19} />
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">REMOTE MONITORING INTELLIGENCE</div>
              <h1>
                {page === "workspace"
                  ? "A clearer picture of care."
                  : page === "patients"
                    ? "Your monitoring cohort."
                    : page === "sources"
                      ? "Every signal, connected."
                      : "A traceable record."}
              </h1>
              <p>
                {page === "workspace"
                  ? "From scattered signals to evidence you can review."
                  : page === "sources"
                    ? "Manage consent and bring wearable measurements into one timeline."
                    : page === "audit"
                      ? "Review activity, check-ins, consent changes, and handoffs."
                      : "Open a patient to explore their measurements and context."}
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => setModal("import")}
            >
              <Upload size={16} /> Import data
            </button>
          </div>
          {error && (
            <div className="alert" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          <div className="stats">
            <div>
              <span>
                MONITORED PATIENTS <Users size={16} />
              </span>
              <strong>{patients.length.toString().padStart(2, "0")}</strong>
              <small>Across connected sources</small>
            </div>
            <div>
              <span>
                PROVIDER REVIEW <ClipboardList size={16} />
              </span>
              <strong>
                {queue
                  .filter((p) => p.evidence.state === "review")
                  .length.toString()
                  .padStart(2, "0")}
                <em>Ready</em>
              </strong>
              <small>Evidence and context available</small>
            </div>
            <div>
              <span>
                AWAITING CONTEXT <AudioLines size={16} />
              </span>
              <strong>
                {queue
                  .filter((p) => p.evidence.state === "context")
                  .length.toString()
                  .padStart(2, "0")}
                <em className="amber">Check-in</em>
              </strong>
              <small>A few questions complete the story</small>
            </div>
            <div>
              <span>
                MONITORING CONSENT <ShieldCheck size={16} />
              </span>
              <strong>
                {patients.filter((p) => p.consent).length}
                <b> / {patients.length}</b>
              </strong>
              <small>Patients with active consent</small>
            </div>
          </div>
          {page === "workspace" && (
            <div className="workspace-grid">
              <section className="patient-list panel">
                <div className="panel-heading">
                  <h2>Review workspace</h2>
                  <span className="number">{patients.length}</span>
                </div>
                <label className="search">
                  <Search size={15} />
                  <input
                    aria-label="Search patients"
                    placeholder="Find a patient…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div className="list-label">
                  PATIENTS <span>STATUS</span>
                </div>
                {patients
                  .filter((p) =>
                    p.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((p) => (
                    <button
                      key={p.id}
                      className={`patient-card ${selected === p.id ? "selected" : ""}`}
                      disabled={busy}
                      onClick={() => {
                        setSelected(p.id);
                        setTab("All data");
                      }}
                    >
                      <div className={`avatar ${p.evidence.state}`}>
                        {p.initials}
                      </div>
                      <div>
                        <strong>{p.name}</strong>
                        <small>
                          {p.id} · {p.dataType}
                        </small>
                        <Badge
                          state={p.acknowledged ? "quiet" : p.evidence.state}
                        >
                          {p.acknowledged
                            ? "Acknowledged"
                            : states[p.evidence.state]}
                        </Badge>
                      </div>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                <div className="queue-note">
                  <ShieldCheck size={17} />
                  <p>
                    Review signals, not diagnoses.
                    <br />
                    You make the clinical decisions.
                  </p>
                </div>
              </section>
              <div className="patient-workspace">
                {patient ? (
                  <>
                    <section className="patient-header panel">
                      <div className="patient-title">
                        <div className="avatar large">{patient.initials}</div>
                        <div>
                          <h2>
                            {patient.name} <span>{patient.id}</span>
                          </h2>
                          <p>
                            {patient.dataType === "synthetic"
                              ? "Synthetic demo patient"
                              : "De-identified wearable dataset"}
                            <span>·</span>
                            {patient.events.length} measurements
                          </p>
                        </div>
                        <Badge state={evidence.state} />
                      </div>
                      <div className="patient-meta">
                        <span>
                          <Watch size={14} />
                          {
                            new Set(patient.events.map((e) => e.source)).size
                          }{" "}
                          data sources
                        </span>
                        <span>
                          <ShieldCheck size={14} />
                          {patient.consent
                            ? "Monitoring consent active"
                            : "Consent revoked"}
                        </span>
                        <span>
                          Latest data {date(evidence.analyzedThrough)}
                        </span>
                      </div>
                    </section>
                    <div className="analysis-bar">
                      <div>
                        <span className="live-dot" />
                        <strong>
                          {patient.execution?.mode || "Local engine"}
                        </strong>
                        <span>
                          {busy
                            ? "Processing measurements…"
                            : "Deterministic statistical analysis"}
                        </span>
                      </div>
                      <div className="simulation-controls">
                        {patient.dataType === "synthetic" && (
                          <select
                            aria-label="Demo scenario"
                            value={scenario}
                            onChange={(e) => setScenario(e.target.value)}
                          >
                            <option value="ambiguous">
                              Coordinated deviation
                            </option>
                            <option value="explained">
                              Workout fluctuation
                            </option>
                            <option value="review">Completed check-in</option>
                          </select>
                        )}
                        <button
                          className="button primary"
                          disabled={busy || !patient.consent}
                          onClick={() =>
                            run(() =>
                              change(
                                patient.dataType === "synthetic"
                                  ? "simulate"
                                  : "analyze",
                                patient.dataType === "synthetic"
                                  ? { scenario }
                                  : {},
                              ),
                            )
                          }
                        >
                          {busy ? (
                            <Loader2 className="spin" size={15} />
                          ) : (
                            <Plus size={15} />
                          )}{" "}
                          {patient.dataType === "synthetic"
                            ? "Simulate new data"
                            : "Run analysis"}
                        </button>
                      </div>
                    </div>
                    <div className="evidence-grid">
                      <section className="timeline panel">
                        <div className="panel-heading">
                          <div>
                            <h2>One patient. One timeline.</h2>
                            <p>
                              Measurements aligned to their individual baseline
                            </p>
                          </div>
                          <Activity size={19} />
                        </div>
                        <div className="tabs">
                          {["All data", "Why flagged", "Context"].map((t) => (
                            <button
                              key={t}
                              className={tab === t ? "chosen" : ""}
                              onClick={() => setTab(t)}
                            >
                              {t}
                              {t === "Why flagged" && (
                                <span>
                                  {
                                    evidence.signals.filter((s) => s.flagged)
                                      .length
                                  }
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                        {tab === "Context" ? (
                          <div className="context-body">
                            <AudioLines size={28} />
                            <h3>
                              {evidence.context
                                ? "Patient context collected"
                                : "Complete the story"}
                            </h3>
                            <p>
                              {evidence.context
                                ? `Recorded ${date(evidence.context.timestamp)}`
                                : "A brief, consented check-in adds context to the measurements."}
                            </p>
                            {evidence.context &&
                              Object.entries(evidence.context)
                                .filter(([k]) =>
                                  [
                                    "exercise",
                                    "fatigue",
                                    "medication",
                                  ].includes(k),
                                )
                                .map(([k, v]) => (
                                  <div className="context-answer" key={k}>
                                    <span>{k}</span>
                                    <strong>{v}</strong>
                                  </div>
                                ))}
                            <button
                              className="button primary"
                              disabled={!patient.consent}
                              onClick={() => {
                                setConsent(false);
                                setAnswers({
                                  exercise: "",
                                  fatigue: "",
                                  medication: "",
                                });
                                setModal("checkin");
                              }}
                            >
                              {evidence.context
                                ? "New check-in"
                                : "Start patient check-in"}
                              <ArrowRight size={15} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="chart-legend">
                              <span>
                                <i /> Individual baseline
                              </span>
                              <span>
                                <i className="window" /> Last{" "}
                                {evidence.windowHours} hours
                              </span>
                            </div>
                            {evidence.signals
                              .filter((s) => tab !== "Why flagged" || s.flagged)
                              .map((s) => (
                                <div className="signal" key={s.metric}>
                                  <div className="signal-label">
                                    <div>
                                      <span
                                        className="metric-dot"
                                        style={{ background: s.color }}
                                      />
                                      <strong>{s.label}</strong>
                                      <small>{s.source}</small>
                                    </div>
                                    <div>
                                      <b>{s.current ?? "—"}</b>{" "}
                                      <small>{s.unit}</small>
                                      <span
                                        className={
                                          s.flagged ? "delta flagged" : "delta"
                                        }
                                      >
                                        {s.delta === null
                                          ? "No baseline"
                                          : `${s.delta > 0 ? "+" : ""}${s.delta}%`}
                                      </span>
                                    </div>
                                  </div>
                                  <Chart
                                    signal={s}
                                    events={patient.events}
                                    windowHours={evidence.windowHours}
                                  />
                                  <div className="signal-foot">
                                    <span>
                                      {s.quality} · {s.baseline.count} baseline
                                      samples
                                    </span>
                                    {s.flagged && (
                                      <span>
                                        {s.duration}h persistent deviation
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            {tab === "Why flagged" &&
                              !evidence.signals.some((s) => s.flagged) && (
                                <div className="context-body">
                                  <CheckCircle2 />
                                  <h3>No persistent signal deviations</h3>
                                  <p>
                                    Inspect the all-data view for measurement
                                    coverage.
                                  </p>
                                </div>
                              )}
                            <div className="timeline-footer">
                              <span>
                                {date(
                                  patient.events
                                    .filter((e) => e.metric === "rhr")
                                    .slice(-21)[0]?.timestamp ||
                                    patient.events[0]?.timestamp,
                                )}
                              </span>
                              <span>{date(evidence.analyzedThrough)}</span>
                            </div>
                          </>
                        )}
                      </section>
                      <aside className="evidence-side">
                        <section className="evidence-card panel">
                          <div className="eyebrow">
                            <Sparkles size={14} /> THE EVIDENCE BRIEF
                          </div>
                          <h2>
                            {evidence.state === "quiet"
                              ? "Measurements in context."
                              : "A pattern worth reviewing."}
                          </h2>
                          <Badge state={evidence.state} />
                          <p className="brief-summary">{evidence.summary}</p>
                          <div className="contributing">
                            <span>CONTRIBUTING SIGNALS</span>
                            {evidence.signals
                              .filter((s) => s.flagged)
                              .map((s) => (
                                <button
                                  key={s.metric}
                                  onClick={() => {
                                    setTab("Why flagged");
                                  }}
                                >
                                  <span>{s.label}</span>
                                  <strong>
                                    {s.delta > 0 ? "+" : ""}
                                    {s.delta}%{" "}
                                    {s.delta > 0 ? (
                                      <ArrowUpRight size={13} />
                                    ) : (
                                      <ArrowDownLeft size={13} />
                                    )}
                                  </strong>
                                </button>
                              ))}
                          </div>
                          <div className="clinical-note">
                            <ShieldCheck size={15} />
                            <span>
                              Statistical evidence only. Provider judgment
                              remains essential.
                            </span>
                          </div>
                          {!evidence.context && evidence.coordinated && (
                            <button
                              className="button primary full"
                              disabled={!patient.consent}
                              onClick={() => {
                                setConsent(false);
                                setAnswers({
                                  exercise: "",
                                  fatigue: "",
                                  medication: "",
                                });
                                setModal("checkin");
                              }}
                            >
                              <AudioLines size={16} /> Gather patient context
                            </button>
                          )}
                          <button
                            className="button secondary full"
                            disabled={busy}
                            onClick={() => run(openFHIR)}
                          >
                            <FileJson size={16} /> View mock FHIR handoff
                          </button>
                          <button
                            className="text-button full"
                            disabled={busy || patient.acknowledged}
                            onClick={() =>
                              run(async () => {
                                await change("acknowledge", {});
                                setNotice(
                                  "Review acknowledged. An audit event has been recorded.",
                                );
                              })
                            }
                          >
                            <Check size={15} />
                            {patient.acknowledged
                              ? "Review acknowledged"
                              : "Acknowledge review"}
                          </button>
                        </section>
                        <section className="method-card">
                          <div>
                            <SlidersHorizontal size={15} />
                            <strong>Transparent by design</strong>
                          </div>
                          <p>{evidence.rule}</p>
                          <span>
                            Template-generated summary · source-linked facts
                          </span>
                        </section>
                      </aside>
                    </div>
                    <section className="workflow panel">
                      <div>
                        <Radio size={17} />
                        <strong>Analysis pipeline</strong>
                        <span>
                          {status?.render
                            ? "Render configured"
                            : "Running locally"}
                        </span>
                      </div>
                      <div className="workflow-steps">
                        {[
                          "Normalize",
                          "Baseline",
                          "Deviation",
                          evidence.context
                            ? "Context collected"
                            : evidence.coordinated
                              ? "Context needed"
                              : "Context optional",
                          "Evidence summary",
                        ].map((step, i) => (
                          <React.Fragment key={step}>
                            <span
                              className={
                                step === "Context needed" ? "pending" : ""
                              }
                            >
                              {step === "Context needed" ? (
                                <AudioLines size={13} />
                              ) : (
                                <CheckCircle2 size={13} />
                              )}{" "}
                              {step}
                            </span>
                            {i < 4 && <ChevronRight size={12} />}
                          </React.Fragment>
                        ))}
                      </div>
                    </section>
                  </>
                ) : (
                  <div className="loading">
                    <Loader2 className="spin" /> Loading patient workspace…
                  </div>
                )}
              </div>
            </div>
          )}
          {page === "patients" && (
            <section className="panel patient-directory">
              {patients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelected(p.id);
                    setPage("workspace");
                  }}
                >
                  <div className="avatar">{p.initials}</div>
                  <div>
                    <h3>{p.name}</h3>
                    <p>
                      {p.dataType} · {p.measurementCount} measurements
                    </p>
                  </div>
                  <Badge state={p.evidence.state} />
                  <ArrowRight size={17} />
                </button>
              ))}
            </section>
          )}
          {page === "sources" && (
            <section className="panel connections">
              <div className="panel-heading">
                <h2>Monitoring consent</h2>
                <Badge state="quiet">Local storage</Badge>
              </div>
              <p>
                Imported files stay in this local workspace. Cloud analysis and
                voice are limited to synthetic demo patients.
              </p>
              {patients.map((p) => (
                <div className="connection-row" key={p.id}>
                  <Watch size={24} />
                  <div>
                    <h3>{p.name}</h3>
                    <p>
                      {p.dataType} · {p.measurementCount} measurements
                    </p>
                  </div>
                  <Badge state={p.consent ? "quiet" : "context"}>
                    {p.consent ? "Connected" : "Revoked"}
                  </Badge>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const updated = await api(`/patients/${p.id}/consent`, {
                          consent: !p.consent,
                        });
                        if (selected === p.id) setPatient(updated);
                        await load();
                      })
                    }
                  >
                    {p.consent ? "Revoke consent" : "Restore consent"}
                  </button>
                </div>
              ))}
              <div className="method-card">
                <h3>Prototype privacy boundaries</h3>
                <p>
                  This build uses a shared provider workspace, local JSON
                  persistence, and an append-only application audit file.
                  Per-user authentication, patient/nurse/admin authorization,
                  per-source consent, encrypted database storage, retention
                  automation, and independently immutable audit storage remain
                  production work. This prototype is not HIPAA compliant.
                </p>
              </div>
            </section>
          )}
          {page === "audit" && (
            <section className="panel audit">
              <div className="panel-heading">
                <h2>Workspace activity</h2>
                <button
                  className="button secondary"
                  onClick={() => download(audit, "relay-audit.json")}
                >
                  <Download size={14} /> Export
                </button>
              </div>
              {audit.length ? (
                audit.map((a) => (
                  <div className="audit-row" key={a.id}>
                    <span className="audit-icon">
                      <ClipboardList size={16} />
                    </span>
                    <div>
                      <strong>{a.action.replaceAll(".", " / ")}</strong>
                      <p>
                        {a.patientId || "Workspace"} · {a.actor}
                        {a.detail && ` · ${a.detail}`}
                      </p>
                    </div>
                    <time>{date(a.at)}</time>
                  </div>
                ))
              ) : (
                <div className="context-body">No activity recorded yet.</div>
              )}
            </section>
          )}
          <footer>
            <span>
              <ShieldCheck size={13} /> Research prototype · No diagnosis or
              treatment recommendations
            </span>
            <span>RELAY / BAY HACKS 2026</span>
          </footer>
        </div>
      </main>
      {(modal || auth) && (
        <div className="modal-backdrop">
          <section
            className={`modal ${modal === "fhir" ? "wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={auth ? "Workspace access" : modal}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => {
                if (!auth) run(closeModal);
              }}
            >
              <X size={20} />
            </button>
            {auth ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sessionStorage.setItem("relay-token", token);
                  run(async () => {
                    await load();
                    setPatient(await api(`/patients/${selected}`));
                    setAuth(false);
                  });
                }}
              >
                <LockKeyhole />
                <h2>Open your workspace</h2>
                <p>Enter the access token configured on the server.</p>
                <input
                  autoFocus
                  type="password"
                  aria-label="Access token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <button className="button primary full">Continue</button>
              </form>
            ) : modal === "checkin" ? (
              <>
                <div className="modal-symbol">
                  <AudioLines />
                </div>
                <div className="eyebrow">PATIENT CHECK-IN</div>
                <h2>A little context goes a long way.</h2>
                <p>
                  Your care team's monitoring program noticed a change in recent
                  measurements. This is not a diagnosis or emergency assessment.
                </p>
                <label className="consent-box">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />{" "}
                  I consent to this check-in and sharing my answers with the
                  demo care team.
                </label>
                <button
                  className="button secondary full"
                  disabled={
                    !consent ||
                    busy ||
                    !status?.voice ||
                    patient?.dataType !== "synthetic"
                  }
                  onClick={() =>
                    run(
                      voice
                        ? async () => {
                            await voiceRef.current?.endSession();
                            voiceRef.current = null;
                            setVoice(null);
                          }
                        : startVoice,
                    )
                  }
                >
                  <AudioLines size={17} />
                  {voice
                    ? `End voice session · ${voiceStatus}`
                    : status?.voice
                      ? "Start ElevenLabs voice check-in"
                      : "Voice not configured · use text below"}
                </button>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      await change("checkin", { ...answers, consent });
                      await closeModal();
                      setTab("Context");
                      setNotice(
                        "Check-in saved. The evidence brief now includes patient-reported context.",
                      );
                    });
                  }}
                >
                  {[
                    [
                      "exercise",
                      "Any recent exercise or unusual activity?",
                      ["No unusual activity", "Recent exercise", "Unsure"],
                    ],
                    [
                      "fatigue",
                      "How has your fatigue changed?",
                      ["None", "Unchanged", "Worsening", "Unsure"],
                    ],
                    [
                      "medication",
                      "Any missed or changed medications?",
                      ["No changes", "Missed or changed", "Unsure"],
                    ],
                  ].map(([key, question, options]) => (
                    <label className="form-field" key={key}>
                      {question}
                      <select
                        required
                        value={answers[key]}
                        onChange={(e) =>
                          setAnswers({ ...answers, [key]: e.target.value })
                        }
                      >
                        <option value="">Choose an answer</option>
                        {options.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <p className="fine-print">
                    For urgent symptoms, follow your existing emergency
                    instructions. Verify the answers above before submitting,
                    including any drafted during a voice session.
                  </p>
                  <button
                    className="button primary full"
                    disabled={!consent || busy}
                  >
                    Save check-in & update summary <ArrowRight size={15} />
                  </button>
                </form>
              </>
            ) : modal === "fhir" ? (
              <>
                <div className="eyebrow">MOCK EHR HANDOFF</div>
                <h2>Evidence that travels.</h2>
                <p>
                  FHIR-shaped Patient, Observation, Communication, and Task
                  resources. No external EHR is connected; this export has not
                  been validated against a FHIR profile.
                </p>
                <pre>{JSON.stringify(bundle, null, 2)}</pre>
                <button
                  className="button primary"
                  onClick={() =>
                    download(bundle, `relay-${selected}-fhir.json`)
                  }
                >
                  <Download size={16} /> Download bundle
                </button>
              </>
            ) : modal === "import" ? (
              <ImportForm
                busy={busy}
                onImport={(body) =>
                  run(async () => {
                    const p = await api("/import", body);
                    await load();
                    setSelected(p.id);
                    setPage("workspace");
                    setModal(null);
                    setNotice(
                      "Wearable measurements imported and analyzed locally.",
                    );
                  })
                }
              />
            ) : (
              <>
                <ShieldCheck />
                <h2>A workspace built for the prototype.</h2>
                <p>
                  {status?.auth}. This is a provider demo, with no role
                  switching or production identity system.
                </p>
                <p>
                  Render Workflows:{" "}
                  {status?.render
                    ? "configured"
                    : "not configured; local engine active"}
                  .<br />
                  ElevenLabs:{" "}
                  {status?.voice
                    ? "configured"
                    : "not configured; text check-in active"}
                  .
                </p>
                <p>
                  All default records are synthetic. Never upload identified
                  health records to this prototype.
                </p>
                <button
                  className="button secondary"
                  onClick={() => {
                    sessionStorage.removeItem("relay-token");
                    location.reload();
                  }}
                >
                  <LogOut size={15} /> Clear access token
                </button>
              </>
            )}
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function ImportForm({ onImport, busy }) {
  const [payload, setPayload] = useState(null),
    [fileError, setFileError] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [dataType, setDataType] = useState("de-identified");
  return (
    <>
      <div className="modal-symbol">
        <Database />
      </div>
      <div className="eyebrow">BRING YOUR OWN SIGNALS</div>
      <h2>Connect a wearable dataset.</h2>
      <p>
        Import normalized JSON from the wearable converter. Apple Watch CSV,
        WHOOP XLSX, and Apple Health XML converters are available in the
        repository.
      </p>
      <label className="upload-zone">
        <Upload size={24} />
        <strong>
          {payload
            ? `${payload.length} measurements ready`
            : "Choose a normalized JSON file"}
        </strong>
        <span>Up to 10,000 records · 3 MB maximum</span>
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            setPayload(null);
            setFileError("");
            try {
              const file = e.target.files[0];
              if (!file) return;
              if (file.size > 3 * 1024 * 1024)
                throw new Error("File exceeds 3 MB.");
              const json = JSON.parse(await file.text());
              const events = Array.isArray(json) ? json : json.events;
              if (!Array.isArray(events))
                throw new Error("Expected an events array.");
              setPayload(events);
            } catch (err) {
              setFileError(err.message);
            }
          }}
        />
      </label>
      <label className="form-field">
        Dataset classification
        <select value={dataType} onChange={(e) => setDataType(e.target.value)}>
          <option value="de-identified">
            De-identified (local analysis only)
          </option>
          <option value="synthetic">Synthetic</option>
        </select>
      </label>
      <label className="consent-box">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />{" "}
        I confirm these records contain no identifying information and I am
        authorized to use them.
      </label>
      {fileError && <div className="alert">{fileError}</div>}
      <button
        className="button primary full"
        disabled={!payload || !confirmed || busy}
        onClick={() => onImport({ events: payload, dataType, confirmed })}
      >
        Import & analyze <ArrowRight size={15} />
      </button>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
