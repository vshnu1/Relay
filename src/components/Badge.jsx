import { states } from "../format.js";
export default function Badge({ state, children }) {
  return (
    <span className={`badge ${state || ""}`}>
      <span className="dot" />
      {children || states[state]}
    </span>
  );
}
