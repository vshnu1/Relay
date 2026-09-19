import { Activity, ChevronRight } from "lucide-react";
import { describeAnalysis } from "../model/mlClient.js";
import { useAnalysis } from "./useAnalysis.js";
import Sparkline from "./Sparkline.jsx";

// The readings lane: one tile per counted signal, then the model's line.
export default function HomeReadings({ patient: p }) {
  const { run, busy, error } = useAnalysis(p);
  const changed = p.counted.filter((s) => s.moved || s.towardDays > 0).length;
  const source = Object.values(p.devices).find(
    (d) => d.connected !== false && d.name,
  );
  return (
    <section className="rx-ph-lane readings" aria-label="Your readings today">
      <header className="rx-ph-lane-head">
        <div className="rx-ph-lane-title">
          <span className="rx-ph-lane-icon">
            <Activity size={16} aria-hidden="true" />
          </span>
          <div>
            <h2>Your readings</h2>
            <span>
              {source ? `From your ${source.name}, ` : "Today, "}compared with
              your usual
            </span>
          </div>
        </div>
        <span className={`rx-ph-count ${changed ? "changed" : ""}`}>
          <i aria-hidden="true" />
          {changed
            ? `${changed} changed`
            : p.counted.some((s) => s.today !== null)
              ? "All usual"
              : "No readings yet"}
        </span>
      </header>

      <div className="rx-ph-tiles">
        {p.counted.map((s) => {
          const attention = s.moved || s.towardDays > 0;
          return (
            <div
              key={s.id}
              className={`rx-ph-tile ${attention ? "changed" : ""}`}
            >
              <div className="rx-ph-tile-top">
                <span>{s.plain}</span>
                <span className="rx-p-chip-sm">
                  {s.today === null
                    ? "No reading"
                    : attention
                      ? "Changed"
                      : "Usual"}
                </span>
              </div>
              <div className="rx-ph-tile-value">
                <strong>{s.today === null ? "—" : s.fmt(s.today)}</strong>
                <span>{s.unit}</span>
                {s.usual !== null && <em>usual {s.fmt(s.usual)}</em>}
              </div>
              <Sparkline signal={s} />
            </div>
          );
        })}
        <div className="rx-ph-tile model">
          <div>
            <span className="rx-ph-kicker">Relay's model</span>
            <strong>
              {p.analysis
                ? describeAnalysis(p.analysis, p.profile)
                : "Not scored yet. Scoring compares your recent readings with your own usual."}
            </strong>
          </div>
          <button
            type="button"
            className="rx-ph-btn outline small"
            disabled={busy}
            onClick={() => run(p.answered ? p.answered.answers : null)}
          >
            {busy ? "Scoring…" : p.analysis ? "Score again" : "Score"}
          </button>
          {error && (
            <p className="rx-p-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>

      <a className="rx-ph-lane-foot" href="#/patient/readings">
        See the charts and add a reading
        <ChevronRight size={16} aria-hidden="true" />
      </a>
    </section>
  );
}
