import { useEffect, useState, useSyncExternalStore } from "react";
import { createStore } from "./data/store.js";
import { createSimulatedSource } from "./data/simulatedSource.js";
import { view } from "./data/derive.js";

// The only line that knows where data comes from. Give createStore any object that
// follows data/contract.js (a WebSocket feed, SSE, the API) and nothing else changes.
export const store = createStore(createSimulatedSource());
if (import.meta.hot) import.meta.hot.dispose(() => store.destroy());

export const actions = store.actions;
export const useRecovery = () =>
  useSyncExternalStore(store.subscribe, store.getState);
export function useCohort() {
  const state = useRecovery();
  return state.order.map((id) => view(state.patients[id], state.now));
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
