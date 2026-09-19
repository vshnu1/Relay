// Which records a clinician's account covers, and the emergency grants that open
// others. This is for display: the server decides what each session may read and
// write (canReach in server/index.js) and refuses the rest whatever this file says.
import { useCallback, useEffect, useMemo, useState } from "react";
import { authHeaders } from "./authHeaders.js";
import { currentUser } from "./currentUser.js";

export const WARD_WIDE = "*";

export const isScoped = (user) =>
  user?.role === "clinician" && !!user.careTeam && user.careTeam !== WARD_WIDE;

// A team is one unit ("Bayfront Health, Respiratory Unit") or the hospital it
// belongs to ("Bayfront Health"), which covers every unit there.
export const onTeam = (team, patient) =>
  !!patient?.hospital &&
  (patient.hospital === team || patient.hospital.startsWith(`${team}, `));

// Every team a roster offers, hospitals first and then their units.
export function careTeamsOf(roster) {
  const units = [...new Set(roster.map((p) => p.hospital).filter(Boolean))];
  const hospitals = [...new Set(units.map((unit) => unit.split(", ")[0]))];
  return hospitals
    .sort()
    .flatMap((hospital) => [
      hospital,
      ...units.filter((unit) => unit.startsWith(`${hospital}, `)).sort(),
    ]);
}

export async function openEmergencyAccess(patientId, reason) {
  const response = await fetch("/api/emergency-access", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ patientId, reason }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error || `That did not work (${response.status}).`);
  return body;
}

// The cohort as this account may see it: the care team's patients, plus any record
// open under an emergency grant until the grant lapses.
export function useCareTeam(cohort) {
  const user = currentUser();
  const scoped = isScoped(user);
  const [grants, setGrants] = useState([]);

  const refresh = useCallback(async () => {
    if (!scoped) return;
    try {
      const response = await fetch("/api/emergency-access", {
        headers: authHeaders({ json: false }),
      });
      if (!response.ok) return;
      const body = await response.json();
      setGrants(Array.isArray(body.open) ? body.open : []);
    } catch {
      // Offline: nothing extra is shown, which is the safe direction to fail in.
    }
  }, [scoped]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Drop a grant from view when it lapses, rather than on the next reload.
  useEffect(() => {
    if (!grants.length) return undefined;
    const next = Math.min(
      ...grants.map((g) => new Date(g.expiresAt).getTime()),
    );
    const timer = setTimeout(
      () =>
        setGrants((list) =>
          list.filter((g) => new Date(g.expiresAt).getTime() > Date.now()),
        ),
      Math.max(1000, next - Date.now() + 500),
    );
    return () => clearTimeout(timer);
  }, [grants]);

  return useMemo(() => {
    if (!scoped)
      return { scoped, team: null, visible: cohort, outside: [], grants: [] };
    const granted = new Set(grants.map((g) => g.patientId));
    const mine = (p) => onTeam(user.careTeam, p) || granted.has(p.id);
    return {
      scoped,
      team: user.careTeam,
      visible: cohort.filter(mine),
      outside: cohort.filter((p) => !mine(p)),
      grants,
      refresh,
    };
  }, [scoped, cohort, grants, user?.careTeam, refresh]);
}
