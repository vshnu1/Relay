import { useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { numberWord } from "../format.js";
import { dayColumns, domain, labelEvery, ticks } from "./chartScale.js";

// One chart at a time, chosen from a strip of the signals the patient's watch profile
// counts (and, set apart, the ones it only records). The chart draws the usual band,
// the counting threshold and the persistent run, and every point has a hover readout
// with the day and the value, so a clinician reads the rule off the picture. A short
// summary sits above the chart and a plain description below it. The day grid from
// the first version stays available as a compact alternative.

const HOME_DAYS = 14;
const CHART_H = 172;
const COMPACT_H = 150;
const MARGIN = { top: 20, right: 112, bottom: 38, left: 44 };
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
const unitWord = (s) => (s.unit === "%" ? "%" : s.unit);
const dirWord = (s) =>
  s.watchDir > 0 ? s.up.toLowerCase() : s.down.toLowerCase();

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

export function SignalChart({ signal: s, homeFrom, width, compact = false }) {
  const [hover, setHover] = useState(null);
  const M = compact ? { top: 20, right: 86, bottom: 36, left: 36 } : MARGIN;
  const inner = width - M.left - M.right;
  const homeDays = s.home.slice(homeFrom);
  const cols = dayColumns(inner, s.before.length, homeDays.length);
  const before = s.before.map((d, i) => ({ ...d, x: M.left + cols[i].mid }));
  const home = homeDays.map((d, i) => ({
    ...d,
    x: M.left + cols[s.before.length + 1 + i].mid,
  }));
  const points = [...before, ...home];
  const values = points.map((d) => d.v).filter((v) => v !== null);
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
  const H = compact ? COMPACT_H : CHART_H;
  const plotH = H - M.top - M.bottom;
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
  const usualY = y(s.usual);
  const thrY = s.threshold === null ? null : y(s.threshold);
  const crowded = thrY !== null && Math.abs(thrY - usualY) < 16;

  // Nearest day column to the pointer, for the hover readout.
  const pick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = null;
    for (const d of points)
      if (best === null || Math.abs(d.x - px) < Math.abs(best.x - px)) best = d;
    setHover(best && Math.abs(best.x - px) <= cols[0].w ? best : null);
  };
  const hovered = hover ?? null;
  const delta = (d) =>
    d.v === null
      ? null
      : s.thr.abs !== undefined
        ? `${d.v - s.usual >= 0 ? "+" : "−"}${Math.abs(d.v - s.usual).toFixed(s.digits || 1)} ${s.unit === "%" ? "points" : s.unit}`
        : `${d.v - s.usual >= 0 ? "+" : "−"}${Math.round((Math.abs(d.v - s.usual) / Math.abs(s.usual)) * 100)}%`;
  const tipLeft = hovered ? Math.min(Math.max(hovered.x, 90), width - 90) : 0;
  return (
    <div className="rx-plot-wrap">
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`${s.name}, one reading per day. Today ${s.fmt(s.today)} ${s.unit}; usual ${s.fmt(s.usual)}${s.threshold !== null ? `; counted past ${s.fmt(s.threshold)}` : ""}.`}
        onMouseMove={pick}
        onMouseLeave={() => setHover(null)}
      >
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
        {/* block captions */}
        <text x={M.left + cols[0].x} y={13} className="rx-axis-cap">
          {beforeWidth >= 120 ? "Before admission" : "Before"}
        </text>
        <text
          x={M.left + cols[s.before.length + 1].x}
          y={13}
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
        <text
          x={M.left - 8}
          y={M.top - 8}
          textAnchor="end"
          className="rx-axis-unit"
        >
          {s.unit}
        </text>
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
          usual {s.fmt(s.usual)} {unitWord(s)}
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
              counts past {s.fmt(s.threshold)} {unitWord(s)}
            </text>
          </>
        )}
        {/* hover guide */}
        {hovered && (
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1={M.top}
            y2={M.top + plotH}
            stroke="#24493d"
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />
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
        {/* points */}
        {points.map((d, i) =>
          d.v === null ? (
            <line
              key={`m${i}`}
              x1={d.x}
              x2={d.x}
              y1={M.top + plotH - 6}
              y2={M.top + plotH}
              stroke="#b8c0b9"
              strokeWidth="2"
            />
          ) : (
            <circle
              key={`p${i}`}
              cx={d.x}
              cy={y(d.v)}
              r={d === hovered ? 6 : d === last ? 5 : 3.5}
              fill={d.day < 0 ? "#7f9389" : "#24493d"}
              stroke="#ffffff"
              strokeWidth={d === hovered || d === last ? 2 : 1}
            />
          ),
        )}
        {last && !hovered && (
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
            <text key={d.day} x={d.x} y={H - 22} textAnchor="middle">
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
              y={H - 22}
              textAnchor="middle"
              style={{ fontWeight: d === last ? 700 : 400 }}
            >
              {d.day}
            </text>
          ) : null,
        )}
        <text
          x={M.left + inner / 2}
          y={H - 4}
          textAnchor="middle"
          className="rx-axis-unit"
        >
          days before admission · days at home
        </text>
      </svg>
      {hovered && (
        <div
          className="rx-tip"
          role="status"
          style={{
            left: tipLeft,
            top:
              hovered.v === null ? M.top + 8 : Math.max(0, y(hovered.v) - 74),
          }}
        >
          <span>{dayName(hovered.day)}</span>
          {hovered.v === null ? (
            <strong>No reading</strong>
          ) : (
            <>
              <strong>
                {s.fmt(hovered.v)} {unitWord(s)}
              </strong>
              <small>
                {delta(hovered)} against usual {s.fmt(s.usual)}
              </small>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// One short line above the chart: what it will show.
function summaryLine(s, profile) {
  if (s.usual === null) return "No usual yet: no readings before admission.";
  if (s.today === null && s.counted)
    return `No reading today. Counted for ${profile.after}.`;
  if (s.today === null) return "No reading today. Recorded, not counted.";
  if (s.moved)
    return `Past its threshold since day ${s.runStart}: ${s.fmt(s.today)} ${unitWord(s)} today against a usual ${s.fmt(s.usual)}.`;
  if (s.towardDays > 0)
    return `Drifting ${dirWord(s)} for ${numberWord(s.towardDays)} ${s.towardDays === 1 ? "day" : "days"}, not yet past the threshold.`;
  if (!s.counted)
    return `Recorded, not counted for ${profile.after}. ${s.fmt(s.today)} ${unitWord(s)} today, usual ${s.fmt(s.usual)}.`;
  return `Inside the usual range: ${s.fmt(s.today)} ${unitWord(s)} today, usual ${s.fmt(s.usual)}.`;
}

// A compact chart caption with only the facts needed to interpret the signal.
function describe(s, p, homeFrom) {
  const shownDays = p.dayHome + 1 - homeFrom;
  const missing = s.home.slice(homeFrom).filter((d) => d.v === null).length;
  const parts = [];
  if (s.usual === null) parts.push("No pre-admission baseline is available.");
  else if (s.today === null) parts.push(`Usual: ${s.fmt(s.usual)} ${unitWord(s)}. No reading today.`);
  else if (s.counted && s.threshold !== null)
    parts.push(
      `Usual ${s.fmt(s.usual)} · trigger ${s.fmt(s.threshold)} · today ${s.fmt(s.today)} ${unitWord(s)}.`,
      s.moved
        ? `Past the trigger since day ${s.runStart}.`
        : `${s.change} from usual; ${s.towardDays > 0 ? `moving ${dirWord(s)}, below the trigger` : "inside the usual range"}.`,
    );
  else
    parts.push(
      `Usual ${s.fmt(s.usual)} · today ${s.fmt(s.today)} ${unitWord(s)}. Recorded for context only.`,
    );
  if (missing > 0)
    parts.push(`${missing} of ${shownDays} home days ${missing === 1 ? "is" : "are"} missing.`);
  return parts.join(" ");
}

function SignalPanel({
  signal: s,
  patient: p,
  homeFrom,
  onPrev,
  onNext,
  position,
}) {
  const [ref, width] = useWidth();
  const state = s.moved
    ? "moved"
    : Math.abs(s.todayLevel ?? 0) >= 1
      ? "drifting"
      : "usual";
  return (
    <article
      className={`rx-signal ${state}${s.counted ? "" : " muted"}`}
      aria-label={s.name}
    >
      <header>
        <div className="rx-signal-title">
          <h3>
            {s.name}
            <small>{position}</small>
          </h3>
          <p className="rx-signal-summary">{summaryLine(s, p.profile)}</p>
        </div>
        <div className="rx-signal-side">
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
          <div className="rx-signal-nav">
            <button
              type="button"
              className="rx-iconbtn"
              aria-label="Previous signal"
              onClick={onPrev}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="rx-iconbtn"
              aria-label="Next signal"
              onClick={onNext}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </header>
      <p className="rx-signal-watch">
        {s.counted
          ? `Counted for ${p.profile.after}. Watching for ${dirWord(s)} than usual.`
          : `Recorded only. Not counted for ${p.profile.after}.`}{" "}
        Source: {s.device === "whoop" ? "WHOOP" : "watch"}.
      </p>
      <div ref={ref} className="rx-signal-plot">
        {width > 0 && (
          <SignalChart signal={s} homeFrom={homeFrom} width={width} />
        )}
      </div>
      <p className="rx-signal-desc">{describe(s, p, homeFrom)}</p>
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
// in profile order, so the chart that matters most opens first.
const rank = (a, b) =>
  b.moved - a.moved ||
  Math.abs(b.todayLevel ?? 0) - Math.abs(a.todayLevel ?? 0) ||
  b.towardDays - a.towardDays;

export default function Readings({ patient: p }) {
  const [mode, setMode] = useState("charts");
  const homeFrom = Math.max(0, p.dayHome + 1 - HOME_DAYS);
  const counted = [...p.counted].sort(rank);
  const recorded = p.signals.filter((s) => !s.counted);
  const order = [...counted, ...recorded];
  const [openId, setOpenId] = useState(() => order[0]?.id ?? null);
  const index = Math.max(
    0,
    order.findIndex((s) => s.id === openId),
  );
  const open = order[index];
  const step = (by) =>
    setOpenId(order[(index + by + order.length) % order.length].id);
  const shownDays = Math.min(HOME_DAYS, p.dayHome + 1);
  const dot = (s) => (s.moved ? "moved" : s.towardDays > 0 ? "drifting" : "");
  const attention = counted.filter(
    (s) => s.moved || Math.abs(s.todayLevel ?? 0) >= 1,
  );
  const stable = counted.filter(
    (s) => !s.moved && Math.abs(s.todayLevel ?? 0) < 1,
  );
  const SignalButton = ({ signal: s }) => (
    <button
      key={s.id}
      type="button"
      aria-current={s.id === open?.id ? "true" : undefined}
      className={dot(s)}
      onClick={() => setOpenId(s.id)}
    >
      <i aria-hidden="true" />
      <span>
        <strong>{s.name}</strong>
        <small>
          {s.moved
            ? `Changed ${s.change}`
            : s.towardDays > 0
              ? "Moving from usual"
              : "Within usual range"}
        </small>
      </span>
    </button>
  );
  return (
    <section
      id="rx-readings"
      className="rx-card rx-readings"
      aria-label="Readings, day by day"
    >
      <div className="rx-readings-head">
        <div>
          <span className="rx-home-kicker">Evidence behind this review</span>
          <h2>Wearable readings</h2>
          <p className="rx-readings-intro">
            {p.moved.length
              ? `${numberWord(p.moved.length, true)} signals moved far enough from ${p.first}'s usual range to contribute to this review.`
              : `No watched signal has produced a persistent change.`}{" "}
            Select a reading to see the evidence over the last {shownDays}{" "}
            {shownDays === 1 ? "day" : "days"} at home.
          </p>
        </div>
        <div className="rx-seg" role="group" aria-label="How to show readings">
          <button
            type="button"
            aria-pressed={mode === "charts"}
            onClick={() => setMode("charts")}
          >
            Chart
          </button>
          <button
            type="button"
            aria-pressed={mode === "grid"}
            onClick={() => setMode("grid")}
          >
            All days
          </button>
        </div>
      </div>
      {mode === "grid" ? (
        <DayGrid patient={p} homeFrom={homeFrom} />
      ) : (
        <>
          <div className="rx-readings-body">
            <nav className="rx-picker" aria-label="Patient readings">
              <span className="rx-picker-group">Needs attention</span>
              <div className="rx-picker-list">
                {(attention.length ? attention : counted.slice(0, 1)).map((s) => (
                  <SignalButton signal={s} key={s.id} />
                ))}
              </div>
              {stable.length > 0 && (
                <details className="rx-picker-more">
                  <summary>{stable.length} other watched readings</summary>
                  <div className="rx-picker-list">
                    {stable.map((s) => <SignalButton signal={s} key={s.id} />)}
                  </div>
                </details>
              )}
              {recorded.length > 0 && (
                <details className="rx-picker-more">
                  <summary>{recorded.length} additional readings</summary>
                  <div className="rx-picker-list">
                    {recorded.map((s) => <SignalButton signal={s} key={s.id} />)}
                  </div>
                </details>
              )}
            </nav>
            <div className="rx-reading-detail">
              {open && (
                <SignalPanel
                  key={open.id}
                  signal={open}
                  patient={p}
                  homeFrom={homeFrom}
                  onPrev={() => step(-1)}
                  onNext={() => step(1)}
                  position={`${index + 1} of ${order.length}`}
                />
              )}
            </div>
          </div>
          <details className="rx-legend-details">
            <summary>How to read this chart</summary>
            <ul className="rx-chart-legend" aria-label="How to read the chart">
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
              <i className="before" /> Readings before admission
            </li>
            <li>
              <i className="run" /> Past the threshold, still going
            </li>
            <li>
              <i className="gap" /> Hospital stay
            </li>
            <li>
              <i className="tick" /> Day with no reading
            </li>
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
