import { useState } from "react";
import { LockKeyhole } from "lucide-react";
export default function AuthForm({ onSubmit }) {
  const [token, setToken] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(token);
      }}
    >
      <LockKeyhole />
      <h2>Open your workspace</h2>
      <p>Enter the access token configured on the server.</p>
      <input
        autoFocus
        type="password"
        aria-label="Access token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <button className="button primary full">Continue</button>
    </form>
  );
}
