import { LogOut, ShieldCheck } from "lucide-react";
export default function AccessModal({ status }) {
  return (
    <>
      <ShieldCheck />
      <h2>A workspace built for the prototype.</h2>
      <p>
        {status?.auth}. This is a provider demo, with no role switching or
        production identity system.
      </p>
      <p>
        Render Workflows:{" "}
        {status?.render ? "configured" : "not configured; local engine active"}
        .<br />
        ElevenLabs:{" "}
        {status?.voice ? "configured" : "not configured; text check-in active"}.
      </p>
      <p>
        All default records are synthetic. Never upload identified health
        records to this prototype.
      </p>
      <button
        className="button secondary"
        onClick={() => {
          sessionStorage.removeItem("relay-token");
          location.reload();
        }}
      >
        <LogOut size={15} /> Clear access token
      </button>
    </>
  );
}
