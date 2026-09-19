import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { actions } from "./useRecovery.js";
import { currentUser } from "./model/currentUser.js";
import "./conversation.css";

// One conversation per patient record, shown the same way on both sides. Messages live
// in the shared record on the server, so they are there after either person signs out
// and back in. `side` is who is looking: "patient" or "clinician".
const DAY = 86400000;
const startOfDay = (t) => new Date(t).setHours(0, 0, 0, 0);
function dayLabel(t, now) {
  const days = Math.round((startOfDay(now) - startOfDay(t)) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(t).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
const timeLabel = (t) =>
  new Date(t)
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase();

export default function Conversation({ patient: p, side }) {
  const mine = side === "patient" ? "patient" : "clinician";
  const me = currentUser();
  const myName = me?.name || (side === "patient" ? p.name : p.clinician);
  const other = side === "patient" ? p.clinician : p.first;
  const messages = p.messages || [];
  const [draft, setDraft] = useState("");
  const thread = useRef(null);
  const inputId = `rx-convo-input-${p.id}`;

  // Seeing a message is reading it; nobody should have to press a button per message.
  // Only while the thread is actually on screen: the clinician's copy sits inside a
  // collapsed panel until it is opened.
  const markSeen = () => {
    if (!thread.current || thread.current.offsetParent === null) return;
    for (const m of messages)
      if (m.by !== mine && !m.readAt) actions.markRead(p.id, m.t);
  };
  useEffect(() => {
    markSeen();
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, p.id]);

  const now = Date.now();
  const rows = [];
  let lastDay = null;
  for (const m of messages) {
    const day = startOfDay(m.t);
    if (day !== lastDay) rows.push({ day: dayLabel(m.t, now), key: `d${day}` });
    lastDay = day;
    rows.push({ m, key: `m${m.t}` });
  }

  return (
    <section
      className={`rx-convo ${side}`}
      aria-label={`Messages with ${other}`}
      onPointerDown={markSeen}
      onFocus={markSeen}
    >
      <ol
        className="rx-convo-thread"
        ref={thread}
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
        aria-label="Conversation"
      >
        {rows.length === 0 && (
          <li className="rx-convo-empty">
            {side === "patient"
              ? `No messages yet. Anything you send here goes to ${other}.`
              : `No messages yet. What you send appears in ${other}'s app.`}
          </li>
        )}
        {rows.map((row) =>
          row.day ? (
            <li key={row.key} className="rx-convo-day">
              <span>{row.day}</span>
            </li>
          ) : (
            <li key={row.key} className={row.m.by === mine ? "mine" : "theirs"}>
              <span className="rx-convo-who">
                {row.m.by === mine ? "You" : row.m.from || other}
              </span>
              <p>{row.m.text}</p>
              <small>
                {timeLabel(row.m.t)}
                {row.m.by === mine && row.m.readAt ? ", seen" : ""}
              </small>
            </li>
          ),
        )}
      </ol>
      <form
        className="rx-convo-compose"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          // The server replaces `by` and `from` with who the session really is. They
          // are sent so the copy shown before the round trip already reads correctly.
          actions.sendMessage(p.id, { by: mine, from: myName, text });
          setDraft("");
        }}
      >
        <label htmlFor={inputId}>
          {side === "patient" ? "Your message" : `Message to ${other}`}
        </label>
        <div>
          <textarea
            id={inputId}
            rows={side === "patient" ? 3 : 2}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              side === "patient"
                ? "What would you like your care team to know?"
                : "Plain words. The patient reads this in their app."
            }
          />
          <button type="submit" disabled={!draft.trim()}>
            <Send size={side === "patient" ? 18 : 15} aria-hidden="true" /> Send
          </button>
        </div>
      </form>
      {side === "patient" && (
        <p className="rx-convo-note">
          Your care team reads messages during working hours, not right away. If
          you feel very unwell, follow the emergency instructions in your
          discharge papers.
        </p>
      )}
    </section>
  );
}
