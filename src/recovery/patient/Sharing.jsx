import { actions } from "../useRecovery.js";
import { ago, dateLong } from "../format.js";

const DAY = 86400000;

export default function Sharing({ patient: p }) {
  const devices = Object.entries(p.devices);
  const anySharing = devices.some(([, d]) => d.sharing);
  return (
    <>
      <h1 className="rx-p-title">Sharing</h1>
      <p className="rx-p-lead">
        You choose what your care team can see. You can stop at any time.
      </p>
      <div className="rx-p-card list">
        {devices.map(([id, d]) => (
          <div className="rx-p-device" key={id}>
            <div>
              <strong>{d.name}</strong>
              <span>
                {!d.sharing
                  ? "Not sharing"
                  : d.live
                    ? "Sharing now"
                    : `Sharing, synced ${ago(Date.now() - d.lastSync)}`}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={d.sharing}
              aria-label={`Share ${d.name} data`}
              onClick={() => actions.setSharing(p.id, id, !d.sharing)}
            >
              <i />
            </button>
          </div>
        ))}
      </div>
      <p className="rx-p-lead">
        Only your care team at {p.hospital} can see this. Sharing stops by
        itself on {dateLong(p.dischargedAt + p.windowDays * DAY)}, day{" "}
        {p.windowDays}.
      </p>
      <div className="rx-p-stack">
        <button
          type="button"
          className="rx-p-btn"
          disabled={!anySharing}
          onClick={() => actions.pauseAll(p.id)}
        >
          {anySharing ? "Pause all sharing" : "All sharing is paused"}
        </button>
        <a className="rx-p-textbtn" href="#/patient/connect">
          Back to your data
        </a>
      </div>
    </>
  );
}
