import { useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import CareTeamPanel from "./CareTeamPanel.jsx";
import "./messages.css";

// Every patient conversation in one place, reached from the sidebar. Whoever is
// waiting on a reply is at the top. The panel on the right is the same one the patient
// overview used to tuck inside a collapsed section: the conversation, and the discharge
// notes and appointments that also go to the patient's app.
const unreadOf = (p) =>
  (p.messages || []).filter((m) => m.by === "patient" && !m.readAt).length;
const lastOf = (p) => (p.messages || [])[(p.messages || []).length - 1] || null;

function when(t) {
  const d = new Date(t);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? d
        .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        .toLowerCase()
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function Messages({ cohort, selectedId }) {
  const [query, setQuery] = useState("");
  const ordered = [...cohort].sort(
    (a, b) =>
      unreadOf(b) - unreadOf(a) ||
      (lastOf(b)?.t || 0) - (lastOf(a)?.t || 0) ||
      a.name.localeCompare(b.name),
  );
  const shown = ordered.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const selected =
    cohort.find((p) => p.id === selectedId) || ordered[0] || null;
  const waiting = cohort.filter((p) => unreadOf(p) > 0).length;
  return (
    <div className="rx-page rx-msgs">
      <header className="rx-pagehead">
        <div>
          <h1>Messages</h1>
          <p>
            {waiting
              ? `${waiting} ${waiting === 1 ? "patient is" : "patients are"} waiting on a reply.`
              : "Nobody is waiting on a reply."}
          </p>
        </div>
      </header>
      <div className="rx-msgs-layout">
        <nav className="rx-card rx-msgs-list" aria-label="Patients">
          <label className="rx-msgs-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Find a patient"
              placeholder="Find a patient"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <ul>
            {shown.map((p) => {
              const last = lastOf(p);
              const unread = unreadOf(p);
              return (
                <li key={p.id}>
                  <a
                    href={`#/doctor/messages/${p.id}`}
                    aria-current={selected?.id === p.id ? "page" : undefined}
                  >
                    <span className="rx-msgs-row-top">
                      <strong>{p.name}</strong>
                      {last && <time>{when(last.t)}</time>}
                    </span>
                    <span className="rx-msgs-row-bottom">
                      <span>
                        {last
                          ? `${last.by === "patient" ? "" : "You: "}${last.text}`
                          : `${p.profile.name}, day ${p.dayHome}. No messages yet.`}
                      </span>
                      {unread > 0 && (
                        <span
                          className="rx-count"
                          aria-label={`${unread} unread`}
                        >
                          {unread}
                        </span>
                      )}
                    </span>
                  </a>
                </li>
              );
            })}
            {shown.length === 0 && (
              <li className="rx-msgs-none">No patient matches that name.</li>
            )}
          </ul>
        </nav>
        {selected ? (
          <section
            className="rx-msgs-pane"
            aria-label={`Conversation with ${selected.name}`}
          >
            <div className="rx-msgs-pane-head">
              <div>
                <h2>{selected.name}</h2>
                <p>
                  {selected.profile.name}, day {selected.dayHome} of{" "}
                  {selected.windowDays} at home
                </p>
              </div>
              <a className="rx-btn" href={`#/doctor/p/${selected.id}`}>
                Open patient record{" "}
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
            <CareTeamPanel key={selected.id} patient={selected} />
          </section>
        ) : (
          <p className="rx-card rx-msgs-none">No patients yet.</p>
        )}
      </div>
    </div>
  );
}
