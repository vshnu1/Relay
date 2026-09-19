import { useEffect, useRef, useState } from "react";

// Automatic logoff. HIPAA's Security Rule names it directly — 45 CFR
// 164.312(a)(2)(iii), "electronic procedures that terminate an electronic
// session after a predetermined time of inactivity" — and it is the one
// technical safeguard a web app can satisfy on its own, without a signed
// agreement or an auditor. A workstation left open on a ward is the ordinary
// way a record is read by someone who should not read it.
//
// Fifteen minutes is the usual clinical convention, with a warning at the last
// minute so nobody loses a half-written check-in to a silent timer.
export const IDLE_MINUTES = 15;
export const IDLE_MS = IDLE_MINUTES * 60 * 1000;
export const WARN_MS = 60 * 1000;

// Activity is the patient or clinician doing something, not the page being
// alive: a polling timer or a streaming reading must never hold a session open.
const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "focusin"];

export function useIdleSignOut(active, onTimeout) {
  const [msLeft, setMsLeft] = useState(null);
  const lastActive = useRef(Date.now());

  useEffect(() => {
    if (!active) {
      setMsLeft(null);
      return undefined;
    }
    const touch = () => {
      lastActive.current = Date.now();
      setMsLeft((current) => (current === null ? null : null));
    };
    for (const name of EVENTS)
      window.addEventListener(name, touch, { passive: true });

    const timer = setInterval(() => {
      const idle = Date.now() - lastActive.current;
      if (idle >= IDLE_MS) {
        onTimeout();
        return;
      }
      // Only render a countdown once one is worth showing, so the common case
      // does not re-render every second for no reason.
      setMsLeft(idle >= IDLE_MS - WARN_MS ? IDLE_MS - idle : null);
    }, 1000);

    return () => {
      for (const name of EVENTS) window.removeEventListener(name, touch);
      clearInterval(timer);
    };
  }, [active, onTimeout]);

  return msLeft;
}

// Shown only in the last minute. It is a warning, not a dialog: anything that
// demanded a click to dismiss would be one more thing between a clinician and
// the patient in front of them.
export function IdleWarning({ msLeft }) {
  if (msLeft === null) return null;
  const seconds = Math.max(1, Math.ceil(msLeft / 1000));
  return (
    <div className="rx-idle-warning" role="status" aria-live="polite">
      <strong>Signing out in {seconds}s</strong>
      <span>
        This workspace locks itself after {IDLE_MS / 60000} minutes without
        activity. Move the pointer or press a key to stay signed in.
      </span>
    </div>
  );
}
