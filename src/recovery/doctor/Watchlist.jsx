import { useState } from "react";
import { Search, ArrowUpRight, CircleAlert, Clock3, CheckCircle2 } from "lucide-react";
import { list, numberWord } from "../format.js";

const GROUPS = [
  {
    id: "review",
    title: "Needs your review",
    empty: "Nobody needs a review right now.",
  },
  { id: "context", title: "Waiting on the patient" },
  {
    id: "monitoring",
    title: "Nothing new",
    collapsible: true,
    summary: (names) =>
      `${list(names)} ${names.length === 1 ? "has" : "have"} nothing new.`,
  },
  {
    id: "nodata",
    title: "Not enough data",
    collapsible: true,
    summary: (names) =>
      `${list(names)} ${names.length === 1 ? "has" : "have"} too few readings to compare.`,
  },
];

export default function Watchlist({ cohort }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState({});
  const shown = cohort.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const reviews = cohort.filter((p) => p.group === "review").length;
  const context = cohort.filter((p) => p.group === "context").length;
  const monitoring = cohort.filter((p) => p.group === "monitoring").length;
  return (
    <div className="rx-page rx-watchlist">
      <header className="rx-pagehead">
        <div>
          <span className="rx-eyebrow">Care team workspace · Today</span>
          <h1>Recovery watch</h1>
          <p>
            {reviews
              ? `${numberWord(reviews, true)} ${reviews === 1 ? "patient needs" : "patients need"} your review today.`
              : "Nobody needs your review right now."}
          </p>
        </div>
        <label className="rx-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            aria-label="Find a patient"
            placeholder="Find a patient"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>
      <div className="rx-watch-statusbar" aria-label="Watchlist summary">
        <span className="rx-watch-total">{cohort.length} patients</span>
        <span className="rx-watch-stat"><CircleAlert size={16} /> <strong>{reviews}</strong> need review</span>
        <span className="rx-watch-stat waiting"><Clock3 size={16} /> <strong>{context}</strong> awaiting check-in</span>
        <span className="rx-watch-stat"><CheckCircle2 size={16} /> <strong>{monitoring}</strong> monitoring</span>
      </div>
      {query.trim() && !shown.length && (
        <p className="rx-card rx-row-summary">No patients match “{query.trim()}”.</p>
      )}
      {GROUPS.map((g) => {
        const rows = shown.filter((p) => p.group === g.id);
        if (!rows.length && (!g.empty || query.trim())) return null;
        const expanded = !g.collapsible || open[g.id] || query.trim() !== "";
        return (
          <section key={g.id} className="rx-group" aria-label={g.title}>
            <div className="rx-group-head">
              <i className={`rx-glyph ${g.id}`} aria-hidden="true" />
              <h2>{g.title}</h2>
              <span>{rows.length}</span>
              {g.collapsible && expanded && !query.trim() && (
                <button
                  type="button"
                  className="rx-textbtn"
                  onClick={() => setOpen({ ...open, [g.id]: false })}
                >
                  Hide
                </button>
              )}
            </div>
            <div className="rx-card rx-rows">
              {expanded && rows.length > 0 && (
                <div className="rx-watch-columns" aria-hidden="true">
                  <span>Patient</span><span>Recovery pathway</span><span>Latest summary</span><span>Signals changed</span><span />
                </div>
              )}
              {!rows.length ? (
                <p className="rx-row-summary">{g.empty}</p>
              ) : !expanded ? (
                <div className="rx-row-summary">
                  <p>{g.summary(rows.map((p) => p.name))}</p>
                  <button
                    type="button"
                    className="rx-btn"
                    aria-expanded="false"
                    onClick={() => setOpen({ ...open, [g.id]: true })}
                  >
                    Show {rows.length}
                  </button>
                </div>
              ) : (
                rows.map((p) => (
                  <div className="rx-row" key={p.id}>
                    <div>
                      <strong>{p.name}</strong>
                      <small>{p.age} years old</small>
                    </div>
                    <div>
                      <span>{p.profile.name}</span>
                      <small>
                        Day {p.dayHome} of {p.windowDays}
                      </small>
                    </div>
                    <p className="rx-watch-finding">
                      {p.acknowledged ? `Reviewed. ${p.line}` : p.line}
                    </p>
                    <div
                      className="rx-pips"
                      title={
                        p.moved.map((s) => s.name).join(", ") ||
                        "No counted signal is past its threshold"
                      }
                    >
                      <div aria-hidden="true">
                        {p.counted.map((s) => (
                          <i key={s.id} className={s.moved ? "on" : ""} />
                        ))}
                      </div>
                      <small>
                        {p.moved.length} of {p.counted.length} signals
                      </small>
                    </div>
                    <a
                      className={`rx-btn ${g.id === "review" ? "primary" : ""}`}
                      href={`#/doctor/p/${p.id}`}
                      aria-label={`Open ${p.name}`}
                    >
                      Open <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  </div>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
