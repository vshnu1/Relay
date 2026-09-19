import { useId } from "react";
import {
  ChevronRight,
  CircleCheck,
  ClipboardList,
  PenLine,
  Smartphone,
  Watch,
} from "lucide-react";
import "./guidance.css";

// One card: the observation, then the short list of what can help. It renders
// whatever guidance.js selected and adds nothing of its own. The evidence line
// stays small, and the one link goes where the guidance says. Nothing when
// there is no guidance.
const ICONS = {
  plan: ClipboardList,
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
        {g.lead && <p>{g.lead}</p>}
        {g.tips?.length > 0 && (
          <ul className="rx-ph-guide-tips">
            {g.tips.map((t) => (
              <li key={t.text}>
                {t.text}
                {t.href && (
                  <>
                    {" "}
                    <a href={t.href}>
                      {t.label}
                      <ChevronRight size={12} aria-hidden="true" />
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <small className="rx-ph-guide-evidence">{g.evidence}</small>
      </div>
      {g.cta && (
        <div className="rx-ph-guide-actions">
          <a
            className={`rx-ph-btn small ${g.cta.primary ? "primary" : "outline"}`}
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
