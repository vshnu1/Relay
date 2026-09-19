import { useEffect } from "react";
import { X } from "lucide-react";

// A side panel for going one level deeper without leaving the dashboard.
// Opens from the right, closes on the button, the backdrop or Escape.
export default function DetailPanel({
  open,
  kicker,
  title,
  onClose,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="rx-panel-root">
      <div className="rx-panel-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        className="rx-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="rx-panel-head">
          <div>
            {kicker && <span className="rx-ph-kicker">{kicker}</span>}
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="rx-panel-close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="rx-panel-body">{children}</div>
      </aside>
    </div>
  );
}
