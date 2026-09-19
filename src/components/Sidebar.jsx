import {
  Activity,
  ArrowUpRight,
  ChevronDown,
  ClipboardList,
  Database,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react";
export default function Sidebar({
  page,
  setPage,
  queueCount,
  onOpenAudit,
  onOpenAccess,
}) {
  return (
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Relay home">
        <div className="brand-mark">
          <Activity size={25} />
        </div>
        relay<span>®</span>
      </a>
      <div className="workspace-label">CARE WORKSPACE</div>
      <button
        className={page === "workspace" ? "nav active" : "nav"}
        onClick={() => setPage("workspace")}
      >
        <LayoutDashboard size={18} /> Monitoring{" "}
        <span className="nav-count">{queueCount}</span>
      </button>
      <button
        className={page === "patients" ? "nav active" : "nav"}
        onClick={() => setPage("patients")}
      >
        <Users size={18} /> Patients
      </button>
      <button
        className={page === "sources" ? "nav active" : "nav"}
        onClick={() => setPage("sources")}
      >
        <Database size={18} /> Data connections
      </button>
      <button
        className={page === "audit" ? "nav active" : "nav"}
        onClick={onOpenAudit}
      >
        <ClipboardList size={18} /> Audit trail
      </button>
      <div className="sidebar-bottom">
        <div className="demo-card">
          <ShieldCheck size={19} />
          <strong>Built for the demo</strong>
          <p>
            Synthetic records.
            <br />
            Human clinical judgment.
          </p>
          <span>
            Bay Hacks 2026 <ArrowUpRight size={12} />
          </span>
        </div>
        <button className="profile" onClick={onOpenAccess}>
          <div className="avatar small">DP</div>
          <div>
            <strong>Demo provider</strong>
            <span>Workspace access</span>
          </div>
          <ChevronDown size={15} />
        </button>
      </div>
    </aside>
  );
}
