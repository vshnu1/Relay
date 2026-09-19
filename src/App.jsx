import { useEffect, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { api } from "./api.js";
import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import PageHeading from "./components/PageHeading.jsx";
import Stats from "./components/Stats.jsx";
import Workspace from "./pages/Workspace.jsx";
import Patients from "./pages/Patients.jsx";
import Sources from "./pages/Sources.jsx";
import Audit from "./pages/Audit.jsx";
import Modal from "./modals/Modal.jsx";
import AuthForm from "./modals/AuthForm.jsx";
import CheckinModal from "./modals/CheckinModal.jsx";
import FhirModal from "./modals/FhirModal.jsx";
import ImportModal from "./modals/ImportModal.jsx";
import AccessModal from "./modals/AccessModal.jsx";
export default function App() {
  const [patients, setPatients] = useState([]),
    [selected, setSelected] = useState("demo-01"),
    [patient, setPatient] = useState(null),
    [status, setStatus] = useState(null);
  const [page, setPage] = useState("workspace"),
    [tab, setTab] = useState("All data"),
    [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [audit, setAudit] = useState([]),
    [bundle, setBundle] = useState(null),
    [auth, setAuth] = useState(false);
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
    return () => window.removeEventListener("relay-auth", handler);
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
  const selectPatient = (id) => {
    setSelected(id);
    setTab("All data");
  };
  const openPatient = (id) => {
    setSelected(id);
    setPage("workspace");
  };
  const analyze = (scenario) =>
    run(() =>
      change(
        patient.dataType === "synthetic" ? "simulate" : "analyze",
        patient.dataType === "synthetic" ? { scenario } : {},
      ),
    );
  const acknowledge = () =>
    run(async () => {
      await change("acknowledge", {});
      setNotice("Review acknowledged. An audit event has been recorded.");
    });
  const toggleConsent = (p) =>
    run(async () => {
      const updated = await api(`/patients/${p.id}/consent`, {
        consent: !p.consent,
      });
      if (selected === p.id) setPatient(updated);
      await load();
    });
  const submitCheckin = (body) =>
    run(async () => {
      await change("checkin", body);
      setModal(null);
      setTab("Context");
      setNotice(
        "Check-in saved. The evidence brief now includes patient-reported context.",
      );
    });
  const importDataset = (body) =>
    run(async () => {
      const p = await api("/import", body);
      await load();
      setSelected(p.id);
      setPage("workspace");
      setModal(null);
      setNotice("Wearable measurements imported and analyzed locally.");
    });
  const signIn = (token) => {
    sessionStorage.setItem("relay-token", token);
    run(async () => {
      await load();
      setPatient(await api(`/patients/${selected}`));
      setAuth(false);
    });
  };
  const queue = patients.filter(
    (p) => p.evidence.state !== "quiet" && !p.acknowledged,
  );
  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        setPage={setPage}
        queueCount={queue.length}
        onOpenAudit={() => run(openAudit)}
        onOpenAccess={() => setModal("access")}
      />
      <main>
        <TopBar page={page} onOpenAccess={() => setModal("access")} />
        <div className="content">
          <PageHeading page={page} onImport={() => setModal("import")} />
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
          <Stats patients={patients} queue={queue} />
          {page === "workspace" && (
            <Workspace
              patients={patients}
              patient={patient}
              selected={selected}
              status={status}
              busy={busy}
              tab={tab}
              setTab={setTab}
              onSelect={selectPatient}
              onRun={analyze}
              onStartCheckin={() => setModal("checkin")}
              onOpenFhir={() => run(openFHIR)}
              onAcknowledge={acknowledge}
            />
          )}
          {page === "patients" && (
            <Patients patients={patients} onOpen={openPatient} />
          )}
          {page === "sources" && (
            <Sources
              patients={patients}
              busy={busy}
              onToggleConsent={toggleConsent}
            />
          )}
          {page === "audit" && <Audit audit={audit} />}
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
        <Modal
          label={auth ? "Workspace access" : modal}
          wide={modal === "fhir"}
          error={error}
          onClose={() => {
            if (!auth) run(async () => setModal(null));
          }}
        >
          {auth ? (
            <AuthForm onSubmit={signIn} />
          ) : modal === "checkin" ? (
            <CheckinModal
              patient={patient}
              status={status}
              busy={busy}
              run={run}
              setError={setError}
              onSubmit={submitCheckin}
            />
          ) : modal === "fhir" ? (
            <FhirModal bundle={bundle} patientId={selected} />
          ) : modal === "import" ? (
            <ImportModal busy={busy} onImport={importDataset} />
          ) : (
            <AccessModal status={status} />
          )}
        </Modal>
      )}
    </div>
  );
}
