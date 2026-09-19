import { Activity, ArrowRight, AudioLines, CheckCircle2 } from "lucide-react";
import Chart from "../../components/Chart.jsx";
import { date } from "../../format.js";
export default function Timeline({ patient, tab, setTab, onStartCheckin }) {
  const evidence = patient.evidence;
  return (
    <section className="timeline panel">
      <div className="panel-heading">
        <div>
          <h2>One patient. One timeline.</h2>
          <p>Measurements aligned to their individual baseline</p>
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
              <span>{evidence.signals.filter((s) => s.flagged).length}</span>
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
              .filter(
                ([k, v]) =>
                  ["exercise", "fatigue", "medication", "notes"].includes(k) &&
                  typeof v === "string" &&
                  v.trim(),
              )
              .map(([k, v]) => (
                <div className="context-answer" key={k}>
                  <span>{k === "notes" ? "additional note" : k}</span>
                  <strong>{v}</strong>
                </div>
              ))}
          <button
            className="button primary"
            disabled={!patient.consent}
            onClick={onStartCheckin}
          >
            {evidence.context ? "New check-in" : "Start patient check-in"}
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
              <i className="window" /> Last {evidence.windowHours} hours
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
                    <b>{s.current ?? "—"}</b> <small>{s.unit}</small>
                    <span className={s.flagged ? "delta flagged" : "delta"}>
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
                    {s.quality} · {s.baseline.count} baseline samples
                  </span>
                  {s.flagged && <span>{s.duration}h persistent deviation</span>}
                </div>
              </div>
            ))}
          {tab === "Why flagged" &&
            !evidence.signals.some((s) => s.flagged) && (
              <div className="context-body">
                <CheckCircle2 />
                <h3>No persistent signal deviations</h3>
                <p>Inspect the all-data view for measurement coverage.</p>
              </div>
            )}
          <div className="timeline-footer">
            <span>
              {date(
                patient.events.filter((e) => e.metric === "rhr").slice(-21)[0]
                  ?.timestamp || patient.events[0]?.timestamp,
              )}
            </span>
            <span>{date(evidence.analyzedThrough)}</span>
          </div>
        </>
      )}
    </section>
  );
}
