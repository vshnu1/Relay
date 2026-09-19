import { MessageSquare } from "lucide-react";

// Unread messages from the care team, shown at the top of Home so a patient sees them
// the moment they sign in instead of finding them two screens away. Opening the
// conversation marks them read (Conversation.jsx), which makes this go away.
export default function HomeMessages({ patient: p }) {
  const unread = (p.messages || []).filter(
    (m) => m.by !== "patient" && !m.readAt,
  );
  if (!unread.length) return null;
  const latest = unread[unread.length - 1];
  const from = latest.from || p.clinician;
  const preview =
    latest.text.length > 110
      ? `${latest.text.slice(0, 107).trimEnd()}…`
      : latest.text;
  return (
    <section
      className="rx-ph-banner message"
      role="status"
      aria-label="New messages"
    >
      <MessageSquare size={22} aria-hidden="true" />
      <div>
        <strong>
          {unread.length === 1
            ? `New message from ${from}`
            : `${unread.length} new messages from your care team`}
        </strong>
        <p>“{preview}”</p>
      </div>
      <div className="rx-ph-banner-actions">
        <a className="rx-ph-btn primary small" href="#/patient/care">
          {unread.length === 1 ? "Read message" : "Read messages"}
        </a>
      </div>
    </section>
  );
}
