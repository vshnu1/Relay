import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { actions } from "../useRecovery.js";
import { SignalChart } from "../doctor/Readings.jsx";
import { SIGNALS } from "../model/profiles.js";
import { numberWord } from "../format.js";
import Sparkline from "./Sparkline.jsx";

const HOME_DAYS = 14;

// Both dimensions: the readings panel is as tall as the window allows, so the
// chart is told how much room it has rather than guessing. The box is sized by
// flex with min-height 0, so its height never follows the chart drawn into it
// and the observer cannot chase itself.
function useBox() {
  const ref = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setBox({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height),
      }),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, box];
}

// One sentence a patient can read without the numbers.
function plain(s) {
  if (s.usual === null)
    return s.device === "manual"
      ? "Enter a reading each day and your pattern will build up here."
      : "There were no readings before your hospital stay, so there is no usual to compare with yet.";
  if (s.today === null) return "No reading yet today.";
  const word = s.watchDir > 0 ? s.up.toLowerCase() : s.down.toLowerCase();
  if (s.moved)
    return `${word[0].toUpperCase() + word.slice(1)} than your usual since day ${s.runStart + 1}. Your care team can see this.`;
  if (s.towardDays > 0)
    return `${word[0].toUpperCase() + word.slice(1)} than your usual for ${s.towardDays === 1 ? "one day" : `${numberWord(s.towardDays)} ${s.span}`}, but not by much.`;
  return "About your usual.";
}

function ManualEntry({ patient: p, signal: s }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const spec = SIGNALS[s.id].manual;
  const submit = (e) => {
    e.preventDefault();
    const v = Number(value);
    if (!Number.isFinite(v) || v < spec.min || v > spec.max) return;
    actions.addManualReading(p.id, s.id, v);
    setValue("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  return (
    <form className="rx-p-entry" onSubmit={submit}>
      <label htmlFor={`rx-entry-${s.id}`}>
        Today's {s.plain.toLowerCase()} <small>{spec.hint}</small>
      </label>
      <div>
        <input
          id={`rx-entry-${s.id}`}
          type="number"
          inputMode="decimal"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={s.unit}
        />
        <button
          type="submit"
          className="rx-p-btn small primary"
          disabled={!value}
        >
          <Plus size={18} aria-hidden="true" /> Add
        </button>
      </div>
      {saved && (
        <span className="rx-p-saved" role="status">
          Saved. Your care team can see it.
        </span>
      )}
    </form>
  );
}

function status(s) {
  if (s.today === null) return { text: "No reading yet today", changed: false };
  if (s.usual === null)
    return { text: "No usual to compare with yet", changed: false };
  const word = s.watchDir > 0 ? s.up.toLowerCase() : s.down.toLowerCase();
  if (s.moved)
    return {
      text: `Changed · ${word} since day ${s.runStart + 1}`,
      changed: true,
    };
  if (s.towardDays > 0)
    return {
      text: `Changed · ${word} for ${s.towardDays === 1 ? "one day" : `${numberWord(s.towardDays)} ${s.span}`}`,
      changed: true,
    };
  return { text: "About your usual", changed: false };
}

export default function Metrics({ patient: p }) {
  const [ref, box] = useBox();
  const counted = p.counted;
  const others = p.signals.filter((s) => !s.counted);
  const order = [...counted, ...others];
  const [openId, setOpenId] = useState(order[0]?.id);
  const index = Math.max(
    0,
    order.findIndex((s) => s.id === openId),
  );
  const s = order[index];
  const step = (by) =>
    setOpenId(order[(index + by + order.length) % order.length].id);
  const homeFrom = Math.max(0, p.dayHome + 1 - HOME_DAYS);
  const st = status(s);

  const item = (x) => {
    const xs = status(x);
    return (
      <button
        key={x.id}
        type="button"
        role="tab"
        aria-selected={x.id === s.id}
        className={`rx-ph-sig ${x.device === "manual" ? "manual" : ""}`}
        onClick={() => setOpenId(x.id)}
      >
        <div>
          <span className="rx-ph-sig-name">{x.plain}</span>
          <span className={`rx-ph-sig-status ${xs.changed ? "changed" : ""}`}>
            {xs.text}
          </span>
        </div>
        <div className="rx-ph-sig-value">
          <strong>{x.today === null ? "Not available" : x.fmt(x.today)}</strong>
          <span>{x.unit}</span>
        </div>
        <div className="rx-ph-sig-spark">
          <Sparkline signal={x} width={56} height={26} />
        </div>
      </button>
    );
  };

  return (
    <>
      <header className="rx-ph-top">
        <div>
          <span className="rx-ph-kicker">
            Your readings · last {HOME_DAYS} days
          </span>
          <h1 className="rx-serif">Compared with what is usual for you</h1>
        </div>
        <div className="rx-ph-legend">
          <span>
            <i className="band" aria-hidden="true" /> Your usual range
          </span>
          <span>
            <i className="thr" aria-hidden="true" /> Where a change counts
          </span>
        </div>
      </header>

      <div className="rx-ph-metrics">
        <div className="rx-ph-siglist" role="tablist" aria-label="Readings">
          <span className="rx-ph-kicker">Counted for {p.profile.after}</span>
          {counted.map(item)}
          {others.length > 0 && (
            <>
              <span className="rx-ph-kicker gap">Recorded, not counted</span>
              {others.map(item)}
            </>
          )}
          <div className="rx-ph-links">
            <a href="#/patient/journal">
              Record something your readings do not show
              <ChevronRight size={16} aria-hidden="true" />
            </a>
            <a href="#/patient/watching">
              What your care team watches, and why
              <ChevronRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>

        <section className="rx-ph-detail" aria-label={s.plain}>
          <header>
            <div>
              <h2>{s.plain}</h2>
              <span>{s.what}</span>
            </div>
            <span className={`rx-p-chip-sm ${st.changed ? "changed" : ""}`}>
              {s.today === null
                ? "No reading"
                : s.moved
                  ? `Changed since day ${s.runStart + 1}`
                  : st.changed
                    ? "Changed"
                    : "Usual"}
            </span>
          </header>

          <div className="rx-ph-figures">
            <div>
              <span className="rx-ph-kicker">
                {s.device === "manual" ? "Today" : "Last night"}
              </span>
              <div className="rx-ph-figure big">
                <strong>
                  {s.today === null ? "Not available" : s.fmt(s.today)}
                </strong>
                <span>{s.unit}</span>
              </div>
            </div>
            <div>
              <span className="rx-ph-kicker">Your usual</span>
              <div className="rx-ph-figure">
                <strong className="pine">
                  {s.usual === null ? "Not available" : s.fmt(s.usual)}
                </strong>
                <span>
                  {s.usual === null ? "not known yet" : "before your stay"}
                </span>
              </div>
            </div>
            <div>
              <span className="rx-ph-kicker">Change</span>
              <div className="rx-ph-figure">
                <strong className={st.changed ? "amber" : "pine"}>
                  {s.today === null || s.usual === null
                    ? "Not available"
                    : s.change}
                </strong>
                <span>
                  {s.towardDays > 0
                    ? `for ${s.towardDays === 1 ? "one day" : `${numberWord(s.towardDays)} ${s.span}`}`
                    : "today"}
                </span>
              </div>
            </div>
          </div>

          <p className={`rx-ph-plain ${st.changed ? "changed" : ""}`}>
            {plain(s)}
          </p>

          <div ref={ref} className="rx-p-plot">
            {box.width > 0 && (
              <SignalChart
                signal={s}
                homeFrom={homeFrom}
                width={box.width}
                height={box.height}
                compact
              />
            )}
          </div>

          {s.device === "manual" && <ManualEntry patient={p} signal={s} />}

          <footer className="rx-ph-detail-foot">
            <small>
              Hover or tap a day to see its reading. A change is not a
              diagnosis; it is a reason for your care team to look.
            </small>
            <div>
              <button
                type="button"
                className="rx-p-iconbtn"
                aria-label="Previous reading"
                onClick={() => step(-1)}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                className="rx-p-iconbtn"
                aria-label="Next reading"
                onClick={() => step(1)}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </footer>
        </section>
      </div>
    </>
  );
}
