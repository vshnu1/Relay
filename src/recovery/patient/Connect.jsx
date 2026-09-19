import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Smartphone, Upload, Watch } from "lucide-react";
import { actions } from "../useRecovery.js";
import { SIGNALS } from "../model/profiles.js";
import { ago, list, numberWord } from "../format.js";

const WEARABLES = [
  {
    id: "watch",
    blurb:
      "Resting heart rate, breathing, blood oxygen, sleep, heart rate variability.",
  },
  { id: "whoop", blurb: "Skin temperature, sleep, heart rate variability." },
];

// A consent sheet in the style of a health app's "Allow access" prompt. Demo: the
// readings then come from the simulated stream; a real connection would use the
// vendor's authorisation flow and deliver readings through the same source contract.
function AllowSheet({ device, patient: p, onClose }) {
  const signals = p.signals.filter((s) => s.device === device.id);
  return (
    <div
      className="rx-p-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={`Connect ${device.name}`}
    >
      <div className="rx-p-sheet-body">
        <Watch size={34} aria-hidden="true" />
        <h2>Allow Relay to read from {device.name}?</h2>
        <p>
          Relay will read these, and only these, and share them with your care
          team at {p.hospital}:
        </p>
        <ul className="rx-p-bullets">
          {signals.map((s) => (
            <li key={s.id}>{s.plain}</li>
          ))}
        </ul>
        <p className="rx-p-fine">
          You can pause or disconnect at any time from this screen.
        </p>
        <div className="rx-p-stack">
          <button
            type="button"
            className="rx-p-btn primary"
            onClick={() => {
              actions.connectDevice(p.id, device.id, true);
              onClose();
            }}
          >
            Allow
          </button>
          <button type="button" className="rx-p-btn" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

function HealthImport({ patient: p }) {
  const [state, setState] = useState({ phase: "idle" });
  const [replace, setReplace] = useState(true);
  const workerRef = useRef(null);
  useEffect(() => () => workerRef.current?.terminate(), []);
  const pick = (file) => {
    if (!file) return;
    setState({ phase: "reading", progress: 0, name: file.name });
    const worker = new Worker(
      new URL("../model/healthWorker.js", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;
    worker.onmessage = (e) => {
      if (e.data.type === "progress")
        setState((s) => ({ ...s, progress: e.data.value }));
      else if (e.data.type === "done") {
        worker.terminate();
        setState({
          phase: "ready",
          name: file.name,
          readings: e.data.readings,
          summary: e.data.summary,
        });
      } else {
        worker.terminate();
        setState({ phase: "error", message: e.data.message });
      }
    };
    worker.onerror = (err) =>
      setState({
        phase: "error",
        message: err.message || "Could not read the file.",
      });
    worker.postMessage({ file });
  };
  const usable = state.readings
    ? Object.entries(state.readings).filter(([signal]) =>
        p.signals.some((s) => s.id === signal),
      )
    : [];
  return (
    <section className="rx-p-card" aria-label="iPhone Health app">
      <div className="rx-p-status">
        <Smartphone size={28} aria-hidden="true" />
        <div>
          <strong>iPhone Health app</strong>
          <span>
            {p.devices.phone?.imports
              ? `Imported ${numberWord(p.devices.phone.imports)} ${p.devices.phone.imports === 1 ? "time" : "times"}, last ${ago(Date.now() - p.devices.phone.lastSync)}`
              : "Nothing imported yet"}
          </span>
        </div>
      </div>
      <p>
        In the Health app, tap your picture, then{" "}
        <strong>Export All Health Data</strong>. Open the export here. It is
        read on this phone only; nothing is uploaded.
      </p>
      {state.phase === "idle" || state.phase === "error" ? (
        <>
          <label className="rx-p-btn">
            <Upload size={20} aria-hidden="true" /> Choose export.zip
            <input
              type="file"
              accept=".zip,.xml,application/zip,text/xml"
              hidden
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>
          {state.phase === "error" && (
            <p className="rx-p-error" role="alert">
              {state.message}
            </p>
          )}
        </>
      ) : state.phase === "reading" ? (
        <div
          className="rx-p-progressbar"
          role="progressbar"
          aria-valuenow={Math.round(state.progress * 100)}
        >
          <i style={{ width: `${Math.round(state.progress * 100)}%` }} />
          <span>
            Reading {state.name}… {Math.round(state.progress * 100)}%
          </span>
        </div>
      ) : state.phase === "ready" ? (
        <>
          <p>
            Found{" "}
            {usable.length
              ? list(
                  usable.map(
                    ([signal, list_]) =>
                      `${SIGNALS[signal].plain.toLowerCase()} (${list_.length} days)`,
                  ),
                )
              : "nothing Relay uses"}{" "}
            in {state.summary.recordsScanned.toLocaleString()} records.
          </p>
          <label className="rx-p-consent">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            <span>
              Use only my own data from now on: replace the example readings and
              stop the simulated stream for me.
            </span>
          </label>
          <div className="rx-p-stack">
            <button
              type="button"
              className="rx-p-btn primary"
              disabled={!usable.length}
              onClick={() => {
                actions.importReadings(
                  p.id,
                  Object.fromEntries(usable),
                  state.summary,
                  { replace },
                );
                setState({ phase: "done", count: usable.length });
              }}
            >
              Add to my readings
            </button>
            <button
              type="button"
              className="rx-p-textbtn"
              onClick={() => setState({ phase: "idle" })}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <p className="rx-p-sent">
          <span>
            <CheckCircle2 size={22} aria-hidden="true" /> Added{" "}
            {numberWord(state.count)} {state.count === 1 ? "signal" : "signals"}{" "}
            to your readings
          </span>
        </p>
      )}
    </section>
  );
}

export default function Connect({ patient: p }) {
  const [allow, setAllow] = useState(null);
  const devices = Object.entries(p.devices).filter(
    ([id]) => !["sensor", "phone", "manual"].includes(id),
  );
  return (
    <>
      <h1 className="rx-p-title">Your data</h1>
      <p className="rx-p-lead">
        Connect a wearable and it shares by itself. Import from the Health app
        whenever you like.
      </p>
      <div className="rx-p-card list">
        {devices.map(([id, d]) => {
          const w = WEARABLES.find((x) => x.id === id);
          const used = p.signals.some((s) => s.device === id);
          return (
            <div className="rx-p-device" key={id}>
              <div>
                <strong>{d.name}</strong>
                <span>
                  {d.connected === false
                    ? "Not connected"
                    : !d.sharing
                      ? "Connected, sharing paused"
                      : `Connected, synced ${ago(Date.now() - d.lastSync)}`}
                </span>
                {w && (
                  <small>
                    {used
                      ? w.blurb
                      : `Nothing it records is watched after ${p.profile.after}.`}
                  </small>
                )}
              </div>
              {!used ? (
                <span className="rx-p-chip">Not used</span>
              ) : d.connected === false ? (
                <button
                  type="button"
                  className="rx-p-btn small primary"
                  onClick={() => setAllow({ id, ...d })}
                >
                  Connect
                </button>
              ) : (
                <button
                  type="button"
                  role="switch"
                  aria-checked={d.sharing}
                  aria-label={`Share ${d.name} data`}
                  onClick={() => actions.setSharing(p.id, id, !d.sharing)}
                >
                  <i />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <HealthImport patient={p} />
      <section className="rx-p-card" aria-label="Your own entries">
        <h2>Your own entries</h2>
        <p>
          {list(
            p.signals
              .filter((s) => s.device === "manual")
              .map((s) => s.plain.toLowerCase()),
          ) || "Nothing"}{" "}
          can be entered by hand from the Readings screen.
        </p>
      </section>
      <p className="rx-p-fine">
        Only your care team at {p.hospital} can see this. Sharing stops by
        itself on day {p.windowDays}.
      </p>
      {allow && (
        <AllowSheet device={allow} patient={p} onClose={() => setAllow(null)} />
      )}
    </>
  );
}
