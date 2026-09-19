import { useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  MapPin,
  MessageSquare,
  PenLine,
  Phone,
  Pill,
} from "lucide-react";
import { ago, clock, dateLong, list } from "../format.js";
import { hospitalInfo } from "./hospitals.js";
import DetailPanel from "./DetailPanel.jsx";

const when = (t) =>
  new Date(t).toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
const longWhen = (t) =>
  new Date(t).toLocaleString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });

// Each row is a button: it opens a side panel with the next level of detail.
function Row({ icon: Icon, label, onOpen, children }) {
  return (
    <button type="button" className="rx-ph-hrow clickable" onClick={onOpen}>
      <span className="rx-ph-hrow-icon">
        <Icon size={17} aria-hidden="true" />
      </span>
      <div>
        <span className="rx-ph-kicker">{label}</span>
        {children}
      </div>
      <ChevronRight size={16} className="rx-ph-hrow-chev" aria-hidden="true" />
    </button>
  );
}

// "Amoxicillin 500 mg, three times a day, 5 more days" -> its parts.
function medParts(text) {
  const [name, ...rest] = text.split(",").map((s) => s.trim());
  return { name, how: rest.join(" · ") };
}

export default function HomeHospital({ patient: p }) {
  const [panel, setPanel] = useState(null);
  const close = () => setPanel(null);
  const info = hospitalInfo(p.hospital);
  const followUp = [...p.appointments]
    .filter((a) => a.t > Date.now())
    .sort((a, b) => a.t - b.t)[0];
  const upcoming = [...p.appointments]
    .filter((a) => a.t > Date.now())
    .sort((a, b) => a.t - b.t);
  const unread = (p.messages || []).filter(
    (m) => m.by !== "patient" && !m.readAt,
  );
  const latest = [...(p.messages || [])]
    .filter((m) => m.by !== "patient")
    .sort((a, b) => b.t - a.t)[0];
  const daysUntil = followUp
    ? Math.round((followUp.t - Date.now()) / 86400000)
    : null;
  const watched = p.counted.map((s) => s.plain.toLowerCase());

  return (
    <section className="rx-ph-lane hospital" aria-label="From your hospital">
      <header className="rx-ph-lane-head">
        <button
          type="button"
          className="rx-ph-lane-title clickable"
          onClick={() => setPanel("hospital")}
        >
          <span className="rx-ph-lane-icon outline">
            <Building2 size={16} aria-hidden="true" />
          </span>
          <div>
            <h2>From {info.name}</h2>
            <span>
              {info.unit ? `${info.unit} · ` : ""}
              {p.clinician}
            </span>
          </div>
          <ChevronRight
            size={16}
            className="rx-ph-hrow-chev"
            aria-hidden="true"
          />
        </button>
        {unread.length > 0 && (
          <span className="rx-ph-count">
            {unread.length} new {unread.length === 1 ? "message" : "messages"}
          </span>
        )}
      </header>

      <div className="rx-ph-hrows">
        <Row
          icon={FileText}
          label="Discharge"
          onOpen={() => setPanel("discharge")}
        >
          <strong>
            {dateLong(p.dischargedAt)} · after a {p.stayDays}-day stay
          </strong>
          <span>
            Home for {p.windowDays} days of watching. Responsible clinician:{" "}
            {p.clinician}.
          </span>
        </Row>
        <Row
          icon={PenLine}
          label="Doctor's notes"
          onOpen={() => setPanel("notes")}
        >
          {p.notes ? (
            <p className="rx-serif rx-ph-notes">{p.notes}</p>
          ) : (
            <span className="rx-p-empty">
              Not written yet. They appear here when your care team adds them.
            </span>
          )}
        </Row>
        <Row icon={Pill} label="Prescriptions" onOpen={() => setPanel("meds")}>
          {p.medications.length ? (
            <ul className="rx-ph-meds">
              {p.medications.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : (
            <span className="rx-p-empty">None listed yet.</span>
          )}
        </Row>
        <Row
          icon={CalendarDays}
          label="Next follow-up"
          onOpen={() => setPanel("followUp")}
        >
          {followUp ? (
            <>
              <strong>
                {when(followUp.t)}
                {daysUntil > 0 &&
                  ` · in ${daysUntil} ${daysUntil === 1 ? "day" : "days"}`}
              </strong>
              <span>
                {followUp.with} · {followUp.where}
              </span>
            </>
          ) : (
            <span className="rx-p-empty">Not scheduled yet.</span>
          )}
        </Row>
        <Row
          icon={MessageSquare}
          label="Message"
          onOpen={() => setPanel("message")}
        >
          {latest ? (
            <>
              <strong>
                {latest.from} · {ago(Date.now() - latest.t)}
                {!latest.readAt && (
                  <i className="rx-ph-dot" aria-label="unread" />
                )}
              </strong>
              <span>“{latest.text}”</span>
            </>
          ) : (
            <span className="rx-p-empty">No messages yet.</span>
          )}
        </Row>
      </div>

      <a className="rx-ph-lane-foot" href="#/patient/care">
        Messages, appointments and send a report
        <ChevronRight size={16} aria-hidden="true" />
      </a>

      <DetailPanel
        open={panel === "hospital"}
        kicker="Your hospital"
        title={info.name}
        onClose={close}
      >
        <dl className="rx-panel-kv">
          <div>
            <dt>
              <MapPin size={15} aria-hidden="true" /> Address
            </dt>
            <dd>{info.address}</dd>
          </div>
          <div>
            <dt>
              <Phone size={15} aria-hidden="true" /> Switchboard
            </dt>
            <dd>
              {info.phone}
              {info.switchboard ? ` · ${info.switchboard}` : ""}
            </dd>
          </div>
          {info.unit && (
            <div>
              <dt>
                <Building2 size={15} aria-hidden="true" /> {info.unit}
              </dt>
              <dd>
                {info.floor && (
                  <>
                    {info.floor}
                    <br />
                  </>
                )}
                {info.about}
              </dd>
            </div>
          )}
          {info.hours && (
            <div>
              <dt>
                <Clock3 size={15} aria-hidden="true" /> Reaching the unit
              </dt>
              <dd>{info.hours}</dd>
            </div>
          )}
          <div>
            <dt>Your clinician</dt>
            <dd>
              {p.clinician}
              {p.careEmail ? (
                <>
                  <br />
                  {p.careEmail}
                </>
              ) : null}
            </dd>
          </div>
        </dl>
        <p className="rx-p-fine">
          Demo directory: the address and numbers are synthetic. Feeling very
          unwell? Follow the emergency instructions in your discharge papers.
        </p>
      </DetailPanel>

      <DetailPanel
        open={panel === "discharge"}
        kicker="Discharge"
        title={`${dateLong(p.dischargedAt)}, after a ${p.stayDays}-day stay`}
        onClose={close}
      >
        <dl className="rx-panel-kv">
          <div>
            <dt>Admitted</dt>
            <dd>{dateLong(p.admittedAt)}</dd>
          </div>
          <div>
            <dt>Discharged</dt>
            <dd>{dateLong(p.dischargedAt)}</dd>
          </div>
          <div>
            <dt>Discharged with</dt>
            <dd>{p.profile.name}</dd>
          </div>
          <div>
            <dt>Recovery window</dt>
            <dd>
              {p.windowDays} days at home · today is day {p.dayHome}
            </dd>
          </div>
          <div>
            <dt>Responsible clinician</dt>
            <dd>
              {p.clinician}, {info.unit || info.name}
            </dd>
          </div>
          <div>
            <dt>What is watched</dt>
            <dd>
              {list(watched)}, each compared with what was usual for you before
              your stay.
            </dd>
          </div>
          <div>
            <dt>Check-ins</dt>
            <dd>
              Every day for the first week home, then every other day, and
              whenever your readings move away from your usual.
            </dd>
          </div>
          <div>
            <dt>Discharge code</dt>
            <dd>
              <code>{p.code}</code>
            </dd>
          </div>
        </dl>
      </DetailPanel>

      <DetailPanel
        open={panel === "notes"}
        kicker="Doctor's notes"
        title={`From ${p.clinician}`}
        onClose={close}
      >
        {p.notes ? (
          <>
            <p className="rx-serif rx-panel-notes">{p.notes}</p>
            <p className="rx-p-fine">
              Written at discharge on {dateLong(p.dischargedAt)} by{" "}
              {p.clinician}, {info.unit || info.name}. Your care team can update
              these from their side; the latest version shows here.
            </p>
          </>
        ) : (
          <p className="rx-p-empty">
            Your care team has not written discharge notes yet. They appear here
            when they do.
          </p>
        )}
      </DetailPanel>

      <DetailPanel
        open={panel === "meds"}
        kicker="Prescriptions"
        title={
          p.medications.length
            ? `${p.medications.length} ${p.medications.length === 1 ? "medicine" : "medicines"} on your discharge plan`
            : "No medicines listed"
        }
        onClose={close}
      >
        {p.medications.length ? (
          <ul className="rx-panel-meds">
            {p.medications.map((m) => {
              const { name, how } = medParts(m);
              return (
                <li key={m}>
                  <Pill size={16} aria-hidden="true" />
                  <div>
                    <strong>{name}</strong>
                    {how && <span>{how}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rx-p-empty">
            Your care team adds medicines to your profile from their side.
          </p>
        )}
        <p className="rx-p-fine">
          As written by your care team at discharge. Do not stop, change or add
          a medicine without asking them. If you miss a dose, say so in your
          next check-in.
        </p>
      </DetailPanel>

      <DetailPanel
        open={panel === "followUp"}
        kicker="Follow-up"
        title={followUp ? longWhen(followUp.t) : "Not scheduled yet"}
        onClose={close}
      >
        {upcoming.length ? (
          <dl className="rx-panel-kv">
            {upcoming.map((a) => (
              <div key={a.t}>
                <dt>{longWhen(a.t)}</dt>
                <dd>
                  {a.with}
                  <br />
                  {a.where}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="rx-p-empty">
            Your care team books follow-ups from their side. They appear here
            with the time and place.
          </p>
        )}
        <p className="rx-p-fine">
          Bring your discharge letter and your medicines. Your readings and
          check-ins are already with your care team.
        </p>
      </DetailPanel>

      <DetailPanel
        open={panel === "message"}
        kicker="From your care team"
        title={
          latest ? `${latest.from}, ${clock(latest.t)}` : "No messages yet"
        }
        onClose={close}
      >
        {latest ? (
          <p className="rx-serif rx-panel-notes">{latest.text}</p>
        ) : (
          <p className="rx-p-empty">
            Messages from your care team appear here. You can write to them from
            the Care team page.
          </p>
        )}
        <a className="rx-p-btn primary" href="#/patient/care">
          Open messages
        </a>
      </DetailPanel>
    </section>
  );
}
