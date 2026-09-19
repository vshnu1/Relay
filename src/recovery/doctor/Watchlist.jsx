import { useState } from "react";
import { Search } from "lucide-react";
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
  return (
    <div className="rx-page">
      <header className="rx-pagehead">
        <div>
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
      {GROUPS.map((g) => {
        const rows = shown.filter((p) => p.group === g.id);
        if (!rows.length && !g.empty) return null;
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
                    <p className="rx-serif">
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
                      Open
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
