// A 14-day line for one signal, with the usual band behind it. Reads the same
// derived series as SignalChart; draws nothing when there is no usual yet.
const DAYS = 14;

export default function Sparkline({ signal: s, width = 200, height = 34 }) {
  const days = s.home.slice(-DAYS);
  const pts = days.map((d) => d.v).filter((v) => v !== null);
  if (s.usual === null || pts.length < 2) return null;
  const band = Math.max(s.sd, Math.abs(s.usual) * 0.005);
  const lo = Math.min(...pts, s.usual - band);
  const hi = Math.max(...pts, s.usual + band);
  const pad = (hi - lo) * 0.15 || 1;
  const y = (v) =>
    height - 3 - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (height - 6);
  const x = (i) => (days.length === 1 ? 0 : (i / (days.length - 1)) * width);
  const line = days
    .map((d, i) =>
      d.v === null ? null : `${x(i).toFixed(1)},${y(d.v).toFixed(1)}`,
    )
    .filter(Boolean)
    .join(" ");
  const attention = s.moved || s.towardDays > 0;
  return (
    <svg
      className="rx-ph-spark"
      aria-hidden="true"
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <rect
        x="0"
        y={y(s.usual + band)}
        width={width}
        height={Math.max(2, y(s.usual - band) - y(s.usual + band))}
        fill="var(--sage)"
      />
      <polyline
        fill="none"
        stroke={attention ? "var(--amber)" : "var(--pine)"}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={line}
      />
    </svg>
  );
}
