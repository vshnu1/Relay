import { X } from "lucide-react";
export default function Modal({ label, wide, error, onClose, children }) {
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
