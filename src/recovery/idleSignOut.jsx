import { useEffect, useRef } from "react";

// Automatic logoff. HIPAA's Security Rule names it directly — 45 CFR
// 164.312(a)(2)(iii), "electronic procedures that terminate an electronic
// session after a predetermined time of inactivity" — and it is the one
// technical safeguard a web app can satisfy on its own, without a signed
// agreement or an auditor. A workstation left open on a ward is the ordinary
// way a record is read by someone who should not read it.
//
// Sign out after fifteen minutes without activity. The expiry is enforced
// silently so it does not interrupt the workspace with a countdown popup.
export const IDLE_MINUTES = 15;
export const IDLE_MS = IDLE_MINUTES * 60 * 1000;

// Activity is the patient or clinician doing something, not the page being
// alive: a polling timer or a streaming reading must never hold a session open.
const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "focusin"];

export function useIdleSignOut(active, onTimeout) {
  const lastActive = useRef(Date.now());
  const timeoutHandler = useRef(onTimeout);

  useEffect(() => {
    timeoutHandler.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!active) return undefined;
    lastActive.current = Date.now();
    let ended = false;
    const touch = () => {
      lastActive.current = Date.now();
    };
    for (const name of EVENTS)
      window.addEventListener(name, touch, { passive: true });

    const timer = setInterval(() => {
      const idle = Date.now() - lastActive.current;
      if (idle >= IDLE_MS && !ended) {
        ended = true;
        timeoutHandler.current();
        return;
      }
    }, 1000);

    return () => {
      for (const name of EVENTS) window.removeEventListener(name, touch);
      clearInterval(timer);
    };
  }, [active]);
}
