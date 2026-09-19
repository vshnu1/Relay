import { useId } from "react";
import {
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Footprints,
  HeartPulse,
  Mic,
  Moon,
  PenLine,
  Route,
  Scale,
  Smartphone,
  Watch,
} from "lucide-react";
import "./guidance.css";

// One card, one next step. It renders whatever guidance.js selected and adds
// nothing of its own: the observation leads, the evidence line is small, and
// the one link goes where the guidance says. Nothing when there is no guidance.
const ICONS = {
  checkin: Mic,
  plan: ClipboardList,
  activity: Footprints,
  gait: Route,
  sleep: Moon,
  pain: HeartPulse,
  weight: Scale,
  watch: Watch,
  phone: Smartphone,
  entry: PenLine,
  usual: CircleCheck,
};

export default function GuidanceCard({
  guidance: g,
  compact = false,
  level = 2,
  kicker = "For today",
}) {
  const headingId = useId();
  if (!g) return null;
  const Icon = ICONS[g.icon] || CircleCheck;
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <section
      className={`rx-ph-guide ${g.tone} ${compact ? "compact" : ""}`}
      aria-labelledby={headingId}
      data-guidance={g.id}
    >
      <span className="rx-ph-guide-icon" aria-hidden="true">
        <Icon size={compact ? 16 : 18} />
      </span>
      <div className="rx-ph-guide-body">
        <span className="rx-ph-kicker">{kicker}</span>
        <Heading id={headingId}>{g.title}</Heading>
        <p>{g.body}</p>
        <small className="rx-ph-guide-evidence">{g.evidence}</small>
      </div>
      {g.cta && (
        <div className="rx-ph-guide-actions">
          <a
            className={`rx-ph-btn small ${g.tone === "attention" ? "primary" : "outline"}`}
            href={g.cta.href}
          >
            {g.cta.label}
            <ChevronRight size={14} aria-hidden="true" />
          </a>
        </div>
      )}
    </section>
  );
}
