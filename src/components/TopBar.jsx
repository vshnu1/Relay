import { ChevronRight, ShieldCheck } from "lucide-react";
export default function TopBar({ page, onOpenAccess }) {
  return (
    <header>
      <div className="breadcrumb">
        Workspace <ChevronRight size={13} />{" "}
        <strong>
          {page === "workspace"
            ? "Monitoring"
            : page === "sources"
              ? "Data connections"
              : page === "audit"
                ? "Audit trail"
                : "Patients"}
        </strong>
      </div>
      <div className="header-right">
        <span className="demo-label">
          <span className="dot" /> Prototype environment
        </span>
        <button
          className="icon-button"
          aria-label="Workspace information"
          onClick={onOpenAccess}
        >
          <ShieldCheck size={19} />
        </button>
      </div>
    </header>
  );
}
