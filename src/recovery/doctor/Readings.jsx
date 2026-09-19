import { useLayoutEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { list, numberWord } from "../format.js";
import { dayColumns, domain, labelEvery, ticks } from "./chartScale.js";

// One chart per signal the patient's watch profile counts, always open, with the
// usual band, the counting threshold and the persistent run drawn and labelled, so a
// clinician reads the rule off the picture instead of decoding colours. The day grid
// from the first version stays available as a compact alternative.

const HOME_DAYS = 14;
const CHART_H = 190;
const M = { top: 22, right: 96, bottom: 26, left: 46 };
const FILL = {
  "-3": "#3d7ab8",
  "-2": "#8fb3d9",
  "-1": "#d3e1f0",
  0: "#e9ece8",
  1: "#f0e1bb",
  2: "#d9b15f",
  3: "#a87a1f",
};

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

const dayName = (d) =>
  d < 0
    ? `${-d} ${-d === 1 ? "day" : "days"} before admission`
    : `Day ${d} at home`;

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

function SignalChart({ signal: s, homeFrom, width }) {
  const inner = width - M.left - M.right;
  const homeDays = s.home.slice(homeFrom);
  const cols = dayColumns(inner, s.before.length, homeDays.length);
  const before = s.before.map((d, i) => ({ ...d, x: M.left + cols[i].mid }));
  const home = homeDays.map((d, i) => ({
    ...d,
    x: M.left + cols[s.before.length + 1 + i].mid,
  }));
  const values = [...before, ...home].map((d) => d.v).filter((v) => v !== null);
  if (!values.length || s.usual === null)
    return (
      <p className="rx-fine">
        {s.usual === null
          ? "No readings before admission, so there is no usual to compare with yet."
          : "No readings to draw yet."}
      </p>
    );
  const band = Math.max(s.sd, Math.abs(s.usual) * 0.005);
  const { lo, hi } = domain({
    values,
    usual: s.usual,
    band,
    threshold: s.threshold,
    unit: s.unit,
  });
  const plotH = CHART_H - M.top - M.bottom;
  const y = (v) => M.top + plotH - ((v - lo) / (hi - lo)) * plotH;
  const stay = cols[s.before.length];
  const runCol =
    s.runStart !== null && s.runStart >= homeFrom
      ? cols[s.before.length + 1 + s.runStart - homeFrom]
      : null;
  const last = [...home].reverse().find((d) => d.v !== null);
  const every = labelEvery(cols[0].w);
  const beforeWidth = cols[s.before.length - 1].x + cols[s.before.length - 1].w;
  const right = M.left + inner;
  const yTicks = ticks(lo, hi, 3);
  const thresholdLabel =
    s.threshold === null
      ? null
      : `counts past ${s.fmt(s.threshold)}${s.unit === "%" ? "%" : ""}`;
  // Keep the two rule labels from sitting on top of each other.
  const usualY = y(s.usual);
  const thrY = s.threshold === null ? null : y(s.threshold);
  const crowded = thrY !== null && Math.abs(thrY - usualY) < 16;
  return (
    <svg
      width={width}
      height={CHART_H}
      role="img"
      aria-label={`${s.name}, one reading per day. Today ${s.fmt(s.today)} ${s.unit}; usual ${s.fmt(s.usual)}${s.threshold !== null ? `; counted past ${s.fmt(s.threshold)}` : ""}.`}
    >
      {/* block captions */}
      <text x={M.left + cols[0].x} y={12} className="rx-axis-cap">
        {beforeWidth >= 120 ? "Before admission" : "Before"}
      </text>
      <text
        x={M.left + cols[s.before.length + 1].x}
        y={12}
        className="rx-axis-cap"
      >
        At home
      </text>
      {/* value axis */}
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={right} y1={y(t)} y2={y(t)} stroke="#edf0ea" />
          <text x={M.left - 8} y={y(t) + 4} textAnchor="end">
            {s.fmt(t)}
          </text>
        </g>
      ))}
      {/* hospital stay */}
      <rect
        x={M.left + stay.x}
        y={M.top}
        width={stay.w}
        height={plotH}
        rx="3"
        fill="url(#rx-hatch)"
      />
      {/* persistent run */}
      {runCol && (
        <rect
          x={M.left + runCol.x - 1.5}
          y={M.top}
          width={right - (M.left + runCol.x) + 1.5}
          height={plotH}
          rx="3"
          fill="#f3d9a0"
          opacity="0.45"
        />
      )}
      {/* usual band and line */}
      <rect
        x={M.left}
        y={y(s.usual + band)}
        width={inner}
        height={Math.max(2, y(s.usual - band) - y(s.usual + band))}
        rx="2"
        fill="#e8f0e4"
      />
      <line
        x1={M.left}
        x2={right + 4}
        y1={usualY}
        y2={usualY}
        stroke="#8fa398"
        strokeDasharray="3 4"
      />
      <text
        x={right + 8}
        y={usualY + (crowded ? (thrY < usualY ? 11 : -7) : 4)}
        className="rx-rule-label pine"
      >
        usual {s.fmt(s.usual)}
      </text>
      {/* threshold */}
      {thrY !== null && (
        <>
          <line
            x1={M.left}
            x2={right + 4}
            y1={thrY}
            y2={thrY}
            stroke="#a87a1f"
            strokeDasharray="5 4"
            strokeWidth="1.5"
          />
          <text
            x={right + 8}
            y={thrY + (crowded ? (thrY < usualY ? -7 : 11) : 4)}
            className="rx-rule-label amber"
          >
            {thresholdLabel}
          </text>
        </>
      )}
      {/* lines */}
      {[
        ...segments(before).map((seg) => [seg, "#7f9389", 1.75]),
        ...segments(home).map((seg) => [seg, "#24493d", 2.25]),
      ].map(([seg, stroke, strokeWidth], i) => (
        <polyline
          key={i}
          points={seg
            .map((d) => `${d.x.toFixed(1)},${y(d.v).toFixed(1)}`)
            .join(" ")}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {/* points, with a tooltip each */}
      {[...before, ...home].map((d, i) =>
        d.v === null ? (
          <g key={`m${i}`}>
            <line
              x1={d.x}
              x2={d.x}
              y1={M.top + plotH - 6}
              y2={M.top + plotH}
              stroke="#b8c0b9"
              strokeWidth="2"
            />
            <title>{`${dayName(d.day)}: no reading`}</title>
          </g>
        ) : (
          <circle
            key={`p${i}`}
            cx={d.x}
            cy={y(d.v)}
            r={d === last ? 5 : 3}
            fill={d === last ? "#24493d" : d.day < 0 ? "#7f9389" : "#24493d"}
            stroke="#ffffff"
            strokeWidth={d === last ? 2 : 1}
          >
            <title>{`${dayName(d.day)}: ${s.fmt(d.v)} ${s.unit} (usual ${s.fmt(s.usual)})`}</title>
          </circle>
        ),
      )}
      {last && (
        <text
          x={last.x}
          y={y(last.v) - 10 >= M.top + 6 ? y(last.v) - 10 : y(last.v) + 18}
          textAnchor="middle"
          className="rx-last-label"
        >
          {s.fmt(last.v)}
        </text>
      )}
      {/* day axis */}
      {before.map((d, i) =>
        i === 0 || i === before.length - 1 ? (
          <text key={d.day} x={d.x} y={CHART_H - 8} textAnchor="middle">
            {d.day}
          </text>
        ) : null,
      )}
      {home.map((d, i) =>
        i === home.length - 1 ||
        (i % every === 0 && home.length - 1 - i >= every) ? (
          <text
            key={d.day}
            x={d.x}
            y={CHART_H - 8}
            textAnchor="middle"
            style={{ fontWeight: d === last ? 700 : 400 }}
          >
            {d.day}
          </text>
        ) : null,
      )}
      <defs>
        <pattern
          id="rx-hatch"
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="5" height="5" fill="#f1f3f0" />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="5"
            stroke="#cfd5ce"
            strokeWidth="1.5"
          />
        </pattern>
      </defs>
    </svg>
  );
}

function signalNote(s, profile) {
  if (s.usual === null)
    return "No usual yet: the watch had no readings before admission.";
  const parts = [];
  if (s.counted && s.threshold !== null) {
    if (s.moved)
      parts.push(
        `Past its threshold since day ${s.runStart}, and counted toward a review.`,
      );
    else if (s.towardDays > 0)
      parts.push(
        `Drifting ${s.watchDir > 0 ? s.up.toLowerCase() : s.down.toLowerCase()} for ${numberWord(s.towardDays)} ${s.towardDays === 1 ? "day" : "days"}, not yet past the threshold.`,
      );
    else parts.push("Inside the usual range.");
    parts.push(
      `Counts when ${s.fmt(s.threshold)} ${s.unit === "%" ? "%" : s.unit} or ${s.watchDir > 0 ? "more" : "less"} for 24 hours.`,
    );
  } else parts.push(`Recorded, not counted for ${profile.after}.`);
  if (s.today === null) parts.push("No reading today.");
  return parts.join(" ");
}

function SignalCard({ signal: s, profile, homeFrom, muted }) {
  const [ref, width] = useWidth();
  const state = s.moved
    ? "moved"
    : Math.abs(s.todayLevel ?? 0) >= 1
      ? "drifting"
      : "usual";
  return (
    <article
      className={`rx-signal ${state}${muted ? " muted" : ""}`}
      aria-label={s.name}
    >
      <header>
        <div>
          <h3>{s.name}</h3>
          <small>
            {s.counted
              ? `Watching for ${s.watchDir > 0 ? s.up.toLowerCase() : s.down.toLowerCase()} than usual`
              : "Recorded only"}
            {" · "}
            {s.device === "whoop" ? "WHOOP" : "watch"}
          </small>
        </div>
        <div className="rx-signal-now">
          <strong>{s.today === null ? "—" : s.fmt(s.today)}</strong>
          <span>{s.unit}</span>
          {s.today !== null && s.usual !== null && (
            <span className={`rx-change ${s.moved ? "moved" : ""}`}>
              {s.moved && (
                <ArrowUp
                  size={13}
                  strokeWidth={2.8}
                  style={{
                    transform: s.watchDir < 0 ? "rotate(180deg)" : undefined,
                  }}
                  aria-hidden="true"
                />
              )}
              {s.change}
            </span>
          )}
        </div>
      </header>
      <div ref={ref} className="rx-signal-plot">
        {width > 0 && (
          <SignalChart signal={s} homeFrom={homeFrom} width={width} />
        )}
      </div>
      <p className="rx-signal-note">{signalNote(s, profile)}</p>
    </article>
  );
}

// The compact day grid from the first version: one square per day per signal.
function DayGrid({ patient: p, homeFrom }) {
  const [ref, width] = useWidth();
  const homeCount = p.dayHome + 1 - homeFrom;
  const cols = width ? dayColumns(width, 7, homeCount, 4) : [];
  const labels = [
    ...[7, 6, 5, 4, 3, 2, 1].map((b) => `-${b}`),
    "stay",
    ...Array.from({ length: homeCount }, (_, i) => String(homeFrom + i)),
  ];
  const bracket =
    p.pattern && p.patternStartDay >= homeFrom && cols.length
      ? cols[8 + p.patternStartDay - homeFrom]
      : null;
  return (
    <>
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
      {p.signals.map((s) => {
        const days = [...s.before, null, ...s.home.slice(homeFrom)];
        return (
          <div key={s.id} className="rx-matrix-row">
            <span style={{ fontSize: 15, fontWeight: s.counted ? 600 : 400 }}>
              {s.name}
            </span>
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
                          ? `${dayName(d.day)}: no reading`
                          : `${dayName(d.day)}: ${s.fmt(d.v)} ${s.unit}, usual ${s.fmt(s.usual)}`
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
        );
      })}
      <ul
        className="rx-legend"
        aria-label="Square colours"
        style={{ marginTop: 10 }}
      >
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
    </>
  );
}

// Signals past their threshold first, then the ones drifting furthest, then the rest
// in profile order, so the chart that matters most is top-left.
const rank = (a, b) =>
  b.moved - a.moved ||
  Math.abs(b.todayLevel ?? 0) - Math.abs(a.todayLevel ?? 0) ||
  b.towardDays - a.towardDays;

export default function Readings({ patient: p }) {
  const [mode, setMode] = useState("charts");
  const [more, setMore] = useState(false);
  const homeFrom = Math.max(0, p.dayHome + 1 - HOME_DAYS);
  const counted = [...p.counted].sort(rank);
  const recorded = p.signals.filter((s) => !s.counted);
  const profile = p.profile;
  return (
    <section
      id="rx-readings"
      className="rx-card rx-readings"
      aria-label="Readings, day by day"
    >
      <div className="rx-readings-head">
        <div>
          <h2>Readings counted for {profile.after}</h2>
          <p className="rx-readings-intro">
            After {profile.after}, Relay watches{" "}
            {list(p.counted.map((s) => s.short))}. A review is recommended when{" "}
            {numberWord(profile.minMoved)} of the {numberWord(p.counted.length)}{" "}
            stay past their threshold for 24 hours, together. Below, the last{" "}
            {Math.min(HOME_DAYS, p.dayHome + 1)}{" "}
            {Math.min(HOME_DAYS, p.dayHome + 1) === 1 ? "day" : "days"} at home
            {p.dayHome + 1 > HOME_DAYS ? ` of ${p.dayHome + 1}` : ""}, against
            this patient's own usual.
          </p>
        </div>
        <div className="rx-seg" role="group" aria-label="How to show readings">
          <button
            type="button"
            aria-pressed={mode === "charts"}
            onClick={() => setMode("charts")}
          >
            Charts
          </button>
          <button
            type="button"
            aria-pressed={mode === "grid"}
            onClick={() => setMode("grid")}
          >
            Day grid
          </button>
        </div>
      </div>
      {mode === "grid" ? (
        <DayGrid patient={p} homeFrom={homeFrom} />
      ) : (
        <>
          <ul className="rx-chart-legend" aria-label="How to read the charts">
            <li>
              <i className="band" /> Usual range before admission
            </li>
            <li>
              <i className="threshold" /> Where a change starts to count
            </li>
            <li>
              <i /> Readings at home
            </li>
            <li>
              <i className="run" /> Past the threshold, still going
            </li>
            <li>
              <i className="gap" /> Hospital stay or no reading
            </li>
          </ul>
          <div className="rx-chart-grid">
            {counted.map((s) => (
              <SignalCard
                key={s.id}
                signal={s}
                profile={profile}
                homeFrom={homeFrom}
              />
            ))}
          </div>
          {recorded.length > 0 && (
            <div className="rx-recorded">
              <div>
                <p>
                  {list(recorded.map((s) => s.short))}{" "}
                  {recorded.length === 1 ? "is" : "are"} recorded but not
                  counted for {profile.after}.
                </p>
                <button
                  type="button"
                  className="rx-btn"
                  aria-expanded={more}
                  onClick={() => setMore(!more)}
                >
                  {more
                    ? "Hide them"
                    : `Show ${recorded.length} more ${recorded.length === 1 ? "chart" : "charts"}`}
                </button>
              </div>
              {more && (
                <div className="rx-chart-grid">
                  {recorded.map((s) => (
                    <SignalCard
                      key={s.id}
                      signal={s}
                      profile={profile}
                      homeFrom={homeFrom}
                      muted
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
