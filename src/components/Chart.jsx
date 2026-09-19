import { date } from "../format.js";
export default function Chart({ signal, events, windowHours = 36 }) {
  const points = events.filter((e) => e.metric === signal.metric).slice(-21);
  if (points.length < 2)
    return (
      <div className="empty-chart">
        Not enough measurements to draw a trend.
      </div>
    );
  const vals = points.map((e) => e.value),
    baseline = signal.baseline.mean;
  const low = Math.min(...vals, baseline ?? Infinity) * 0.94,
    high = Math.max(...vals, baseline ?? -Infinity) * 1.06;
  const start = Date.parse(points[0].timestamp),
    end = Date.parse(points.at(-1).timestamp);
  const x = (t) => 8 + ((Date.parse(t) - start) / (end - start || 1)) * 684;
  const y = (v) => 80 - ((v - low) / (high - low || 1)) * 64;
  return (
    <svg
      viewBox="0 0 700 98"
      role="img"
      aria-label={`${signal.label} timeline. Baseline ${baseline?.toFixed(1) ?? "unavailable"} ${signal.unit}.`}
    >
      <rect
        x={Math.max(0, x(new Date(end - windowHours * 3600000).toISOString()))}
        y="0"
        width="700"
        height="95"
        fill={signal.flagged ? "#faf0e7" : "#f2f5f3"}
      />
      {baseline !== null && (
        <>
          <line
            x1="0"
            x2="700"
            y1={y(baseline)}
            y2={y(baseline)}
            stroke="#b8c2bd"
            strokeDasharray="4 5"
          />
          <text
            x="5"
            y={Math.max(10, y(baseline) - 5)}
            fill="#96a29c"
            fontSize="9"
          >
            BASELINE {baseline.toFixed(1)}
          </text>
        </>
      )}
      <polyline
        points={points.map((e) => `${x(e.timestamp)},${y(e.value)}`).join(" ")}
        fill="none"
        stroke={signal.color}
        strokeWidth="2.3"
        strokeLinejoin="round"
      />
      {points.map((e) => (
        <circle
          key={e.id}
          cx={x(e.timestamp)}
          cy={y(e.value)}
          r="3"
          fill={signal.color}
        >
          <title>{`${date(e.timestamp)}: ${e.value} ${signal.unit} · ${e.source} · ${e.id}`}</title>
        </circle>
      ))}
    </svg>
  );
}
