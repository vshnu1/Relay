import { useLayoutEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

const FILL = {
  "-3": "#3d7ab8",
  "-2": "#8fb3d9",
  "-1": "#d3e1f0",
  0: "#e9ece8",
  1: "#f0e1bb",
  2: "#d9b15f",
  3: "#a87a1f",
};
const GAP = 4;
const HOME_DAYS = 14;
const CHART_H = 120;

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

// One geometry for squares and charts, so a point always sits under its square.
function layout(width, before, home) {
  const unit = (width - GAP * (before + home)) / (before + home + 1.2);
  const cols = [];
  let x = 0;
  for (let i = 0; i < before + 1 + home; i++) {
    const w = i === before ? unit * 1.2 : unit;
    cols.push({ x, w, mid: x + w / 2 });
    x += w + GAP;
  }
  return cols;
}

function Chart({ signal, cols, width, homeFrom }) {
  const before = signal.before.map((d, i) => ({ ...d, x: cols[i].mid }));
  const home = signal.home
    .slice(homeFrom)
    .map((d, i) => ({ ...d, x: cols[signal.before.length + 1 + i].mid }));
  const values = [...before, ...home].map((d) => d.v).filter((v) => v !== null);
  if (!values.length || signal.usual === null)
    return <p className="rx-fine">No readings to draw yet.</p>;
  const band = Math.max(signal.sd, Math.abs(signal.usual) * 0.005);
  let lo = Math.min(...values, signal.usual - band);
  let hi = Math.max(...values, signal.usual + band);
  const pad = (hi - lo) * 0.14 || 1;
  lo -= pad;
  hi += pad;
  const y = (v) => CHART_H - 12 - ((v - lo) / (hi - lo)) * (CHART_H - 24);
  // Break the line at missing days instead of drawing through them.
  const segments = (points) =>
    points
      .reduce(
        (acc, d) =>
          d.v === null
            ? [...acc, []]
            : [...acc.slice(0, -1), [...acc[acc.length - 1], d]],
        [[]],
      )
      .filter((s) => s.length);
  const stay = cols[signal.before.length];
  const runCol =
    signal.runStart !== null && signal.runStart >= homeFrom
      ? cols[signal.before.length + 1 + signal.runStart - homeFrom]
      : null;
  const last = [...home].reverse().find((d) => d.v !== null);
  const label = (d) =>
    `${d.day < 0 ? `${-d.day} days before admission` : `Day ${d.day}`}: ${signal.fmt(d.v)} ${signal.unit}`;
  return (
    <svg
      width={width}
      height={CHART_H}
      role="img"
      aria-label={`${signal.name}, daily readings. Today ${signal.fmt(signal.today)} ${signal.unit}, usual ${signal.fmt(signal.usual)}.`}
    >
      <rect
        x="0"
        y={y(signal.usual + band)}
        width={width}
        height={y(signal.usual - band) - y(signal.usual + band)}
        rx="3"
        fill="#e8f0e4"
      />
      {runCol && (
        <rect
          x={runCol.x - GAP / 2}
          y="0"
          width={width - runCol.x + GAP / 2}
          height={CHART_H}
          rx="3"
          fill="#f3d9a0"
          opacity="0.5"
        />
      )}
      <rect
        x={stay.x}
        y="0"
        width={stay.w}
        height={CHART_H}
        rx="3"
        fill="#ffffff"
      />
      <rect
        x={stay.x}
        y="0"
        width={stay.w}
        height={CHART_H}
        rx="3"
        fill="#f1f2ef"
      />
      <line
        x1="0"
        x2={width}
        y1={y(signal.usual)}
        y2={y(signal.usual)}
        stroke="#8fa398"
        strokeDasharray="3 4"
      />
      {[
        ...segments(before).map((s) => [s, "#7f9389", 1.75]),
        ...segments(home).map((s) => [s, "#24493d", 2]),
      ].map(([s, stroke, strokeWidth], i) => (
        <polyline
          key={i}
          points={s
            .map((d) => `${d.x.toFixed(1)},${y(d.v).toFixed(1)}`)
            .join(" ")}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {[...before, ...home]
        .filter((d) => d.v !== null)
        .map((d) => (
          <circle
            key={d.day}
            cx={d.x}
            cy={y(d.v)}
            r={d === last ? 5 : 7}
            fill={d === last ? "#24493d" : "transparent"}
            stroke={d === last ? "#ffffff" : "none"}
            strokeWidth="2"
          >
            <title>{label(d)}</title>
          </circle>
        ))}
    </svg>
  );
}

export default function Readings({ patient: p }) {
  const [ref, width] = useWidth();
  // Open the highest-contributing signal by default so its chart, with the green
  // usual-band, is visible without a click. Prefer a signal past its threshold, then
  // the one furthest from usual today; fall back to a counted signal so something is
  // always open even when nothing has moved.
  const [openId, setOpenId] = useState(() => {
    const top = [...p.counted].sort(
      (a, b) =>
        b.moved - a.moved ||
        Math.abs(b.todayLevel ?? 0) - Math.abs(a.todayLevel ?? 0) ||
        b.towardDays - a.towardDays,
    )[0];
    return (top ?? p.signals[0])?.id ?? null;
  });
  const [more, setMore] = useState(false);
  const homeFrom = Math.max(0, p.dayHome + 1 - HOME_DAYS);
  const homeCount = p.dayHome + 1 - homeFrom;
  const cols = width ? layout(width, 7, homeCount) : [];
  const labels = [
    ...[7, 6, 5, 4, 3, 2, 1].map((b) => `-${b}`),
    "stay",
    ...Array.from({ length: homeCount }, (_, i) => String(homeFrom + i)),
  ];
  const rows = p.signals.filter((s) => s.counted || more);
  const extra = p.signals.length - p.counted.length;
  const bracket =
    p.pattern && p.patternStartDay >= homeFrom && cols.length
      ? cols[8 + p.patternStartDay - homeFrom]
      : null;
  return (
    <section
      id="rx-readings"
      className="rx-card rx-readings"
      aria-label="Readings, day by day"
    >
      <div className="rx-readings-head">
        <div>
          <h2>Readings, day by day</h2>
          <p>
            One square per day, against this patient's own usual. Open a signal
            to see its readings.
          </p>
        </div>
        <ul className="rx-legend" aria-label="Square colors">
          <li>
            <i style={{ background: FILL[2] }} />
            Toward the watched direction
          </li>
          <li>
            <i style={{ background: FILL[0] }} />
            Usual
          </li>
          <li>
            <i style={{ background: FILL[-2] }} />
            Away
          </li>
        </ul>
      </div>
      <div className="rx-matrix-row rx-matrix-labels" aria-hidden="true">
        <span>Days from coming home</span>
        <div ref={ref} className="rx-cells">
          {bracket && (
            <span
              className="rx-bracket"
              style={{ left: bracket.x, width: width - bracket.x }}
            >
              <b>{p.hours} hours</b>
            </span>
          )}
          {cols.map((c, i) => (
            <span key={i} style={{ width: c.w }}>
              {labels[i]}
            </span>
          ))}
        </div>
        <span />
      </div>
      {rows.map((s) => {
        const open = openId === s.id;
        const days = [...s.before, null, ...s.home.slice(homeFrom)];
        return (
          <div key={s.id}>
            <div className="rx-matrix-row">
              <button
                type="button"
                aria-expanded={open}
                className={open ? "open" : ""}
                onClick={() => setOpenId(open ? null : s.id)}
              >
                <ChevronRight size={16} aria-hidden="true" />
                {s.name}
              </button>
              <div
                className="rx-cells"
                role="img"
                aria-label={`${s.name}: ${s.moved ? `past its threshold since day ${s.runStart}` : "no persistent change"}.`}
              >
                {cols.map((c, i) => {
                  const d = days[i];
                  const empty = !d || d.level === null;
                  return (
                    <i
                      key={i}
                      className={empty ? "hatch" : ""}
                      style={{
                        width: c.w,
                        background: empty ? undefined : FILL[d.level],
                      }}
                      title={
                        d
                          ? d.v === null
                            ? `Day ${d.day}: no reading`
                            : `${d.day < 0 ? `${-d.day} days before admission` : `Day ${d.day}`}: ${s.fmt(d.v)} ${s.unit}, usual ${s.fmt(s.usual)}`
                          : "In hospital"
                      }
                    />
                  );
                })}
              </div>
              <span className="rx-delta">
                {s.counted || Math.abs(s.todayLevel ?? 0) >= 1
                  ? s.change
                  : "usual"}
              </span>
            </div>
            {open && width > 0 && (
              <div className="rx-chart">
                <Chart
                  signal={s}
                  cols={cols}
                  width={width}
                  homeFrom={homeFrom}
                />
                <p>
                  Today {s.fmt(s.today)} {s.unit}. Usual is {s.fmt(s.usual)}{" "}
                  {s.unit}, shown as the green band.{" "}
                  {s.rule || `Recorded, not counted for ${p.profile.after}.`}
                </p>
              </div>
            )}
          </div>
        );
      })}
      {extra > 0 && (
        <div className="rx-more">
          <p>
            {more
              ? `Showing ${extra} more signals that are recorded but not counted for ${p.profile.after}.`
              : `${extra} more signals are recorded but not counted for ${p.profile.after}.`}
          </p>
          <button
            type="button"
            className="rx-btn"
            aria-expanded={more}
            onClick={() => setMore(!more)}
          >
            {more ? "Hide them" : `Show ${extra} more`}
          </button>
        </div>
      )}
    </section>
  );
}
