import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { actions } from "../useRecovery.js";
import { SignalChart } from "../doctor/Readings.jsx";
import { SIGNALS } from "../model/profiles.js";
import { numberWord } from "../format.js";

const HOME_DAYS = 14;

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

// One sentence a patient can read without the numbers.
function plain(s) {
  if (s.usual === null)
    return s.device === "manual"
      ? "Enter a reading each day and your pattern will build up here."
      : "There were no readings before your hospital stay, so there is no usual to compare with yet.";
  if (s.today === null) return "No reading yet today.";
  const word = s.watchDir > 0 ? s.up.toLowerCase() : s.down.toLowerCase();
  if (s.moved)
    return `${word[0].toUpperCase() + word.slice(1)} than your usual since day ${s.runStart}. Your care team can see this.`;
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
        <span className="rx-p-saved">Saved. Your care team can see it.</span>
      )}
    </form>
  );
}

export default function Metrics({ patient: p }) {
  const [ref, width] = useWidth();
  const order = [...p.counted, ...p.signals.filter((s) => !s.counted)];
  const [openId, setOpenId] = useState(order[0]?.id);
  const index = Math.max(
    0,
    order.findIndex((s) => s.id === openId),
  );
  const s = order[index];
  const step = (by) =>
    setOpenId(order[(index + by + order.length) % order.length].id);
  const homeFrom = Math.max(0, p.dayHome + 1 - HOME_DAYS);
  return (
    <>
      <h1 className="rx-p-title">Your readings</h1>
      <p className="rx-p-lead">
        Each one is compared with what was usual for you before your hospital
        stay. Green is your usual; the amber line is where a change starts to
        count.
      </p>
      <div className="rx-p-pills" role="tablist" aria-label="Readings">
        {order.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={x.id === s.id}
            className={x.moved ? "moved" : x.towardDays > 0 ? "drifting" : ""}
            onClick={() => setOpenId(x.id)}
          >
            {x.plain}
          </button>
        ))}
      </div>
      <section className="rx-p-card rx-p-metric" aria-label={s.plain}>
        <header>
          <button
            type="button"
            className="rx-p-iconbtn"
            aria-label="Previous"
            onClick={() => step(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2>{s.plain}</h2>
            <span>
              {s.counted
                ? `Counted for ${p.profile.after}`
                : "Recorded, not counted"}{" "}
              · {index + 1} of {order.length}
            </span>
          </div>
          <button
            type="button"
            className="rx-p-iconbtn"
            aria-label="Next"
            onClick={() => step(1)}
          >
            <ChevronRight size={20} />
          </button>
        </header>
        <div className="rx-p-now">
          <strong>{s.today === null ? "—" : s.fmt(s.today)}</strong>
          <span>{s.unit}</span>
          {s.usual !== null && <small>usual {s.fmt(s.usual)}</small>}
          {s.today !== null && s.usual !== null && (
            <em
              className={`rx-p-chip ${s.moved || s.towardDays ? "changed" : ""}`}
            >
              {s.change}
            </em>
          )}
        </div>
        <p className={`rx-p-plain ${s.moved ? "moved" : ""}`}>{plain(s)}</p>
        <div ref={ref} className="rx-p-plot">
          {width > 0 && (
            <SignalChart signal={s} homeFrom={homeFrom} width={width} compact />
          )}
        </div>
        <small className="rx-p-fine">{s.what}</small>
        {s.device === "manual" && <ManualEntry patient={p} signal={s} />}
      </section>
      <p className="rx-p-fine">
        Hover or tap a day to see its reading. A change is not a diagnosis; it
        is a reason for your care team to look.
      </p>
    </>
  );
}
