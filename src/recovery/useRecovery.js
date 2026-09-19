import { useEffect, useState, useSyncExternalStore } from "react";
import { createStore } from "./model/store.js";
import { createSimulatedSource } from "./model/simulatedSource.js";
import { view } from "./model/derive.js";

// The only line that knows where data comes from. Give createStore any object that
// follows model/contract.js (a WebSocket feed, SSE, the API) and nothing else changes.
export const store = createStore(createSimulatedSource());
if (import.meta.hot) import.meta.hot.dispose(() => store.destroy());

export const actions = store.actions;
export const useRecovery = () =>
  useSyncExternalStore(store.subscribe, store.getState);
export const useSourceLabel = () =>
  useSyncExternalStore(store.subscribe, () => store.getState().sourceLabel);
export function useCohort() {
  const state = useRecovery();
  return state.order.map((id) => view(state.patients[id], state.now));
}
// Identities only, id, name, and whether a check-in is waiting. The patient app uses
// this for the demo role switcher without deriving (or holding) anyone else's record.
export function useRoster() {
  const state = useRecovery();
  return state.order.map((id) => {
    const p = state.patients[id];
    const last = p.checkins[p.checkins.length - 1];
    return {
      id,
      name: p.name,
      hospital: p.hospital,
      code: p.code,
      pending: !!(last && !last.answeredAt),
    };
  });
}
export function usePatient(id) {
  const state = useRecovery();
  return state.patients[id] ? view(state.patients[id], state.now) : null;
}

// Hash routes keep the back button and shareable links working with no router dependency.
const parse = () =>
  location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
export const go = (path) => {
  location.hash = path;
};
