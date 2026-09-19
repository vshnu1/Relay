import { useEffect } from "react";
import { X } from "lucide-react";
export default function Modal({ label, wide, error, onClose, children }) {
  // Escape closes the dialog. onClose is a no-op for the access modal, which
  // must stay dismissal-proof, so this needs no special case here.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop">
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <button
          className="modal-close icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        {children}
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
      </section>
    </div>
  );
}
