/**
 * Runs shared/engine.js against real wearable data and reports what the
 * engine does with it.
 *
 *   node tools/check_engine_on_real_data.mjs
 *
 * Needs shared/engine.js, which lives on the application branch. Run this
 * from a checkout that has both (after a merge, or copy fixtures/ across).
 *
 * Exits non-zero when the engine cannot flag anything on real data, so it
 * works as a regression check once the baseline gate is fixed.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const enginePath = process.argv[2] ?? resolve(root, "shared/engine.js");
const eventsPath = resolve(root, "fixtures/relay_events.json");

if (!existsSync(enginePath)) {
  console.error(`No engine at ${enginePath}`);
  console.error("shared/engine.js lives on the application branch. Either run this");
  console.error("from a checkout that has both, or pass the path as an argument.");
  process.exit(2);
}

const { analyze, calculateBaseline, normalize, cadenceHours, METRICS } = await import(enginePath);
const events = JSON.parse(readFileSync(eventsPath, "utf8"));
const days = [...new Set(events.map((e) => e.timestamp.slice(0, 10)))].sort();

console.log(`${events.length} real measurements, ${days.length} days, ${days[0]} .. ${days.at(-1)}`);

// The engine's baseline gate wants 12 samples in a 14-day window. Whether a
// metric can ever clear that is a property of its coverage, not of the
// patient, so compute it up front.
console.log("\ncoverage vs the 12-sample / 14-day baseline gate");
console.log(`${"metric".padEnd(14)}${"days".padStart(6)}${"coverage".padStart(10)}${"per 14d".padStart(9)}  verdict`);
const span = (Date.parse(days.at(-1)) - Date.parse(days[0])) / 86400000 + 1;
for (const metric of Object.keys(METRICS)) {
  const n = new Set(events.filter((e) => e.metric === metric).map((e) => e.timestamp.slice(0, 10))).size;
  if (!n) {
    console.log(`${metric.padEnd(14)}${String(0).padStart(6)}${"—".padStart(10)}${"—".padStart(9)}  not collected`);
    continue;
  }
  const coverage = n / span;
  const per14 = coverage * 14;
  const verdict = per14 >= 12 ? "can pass" : "GATED OFF — cannot ever flag";
  console.log(`${metric.padEnd(14)}${String(n).padStart(6)}${(coverage * 100).toFixed(0).padStart(9)}%${per14.toFixed(1).padStart(9)}  ${verdict}`);
}

const norm = normalize(events);
console.log(`\nobserved cadence: ${cadenceHours(norm)}h (the synthetic generator emits every 6h)`);

// Days where a personal-baseline detector finds a real multi-signal event.
const EVENT_DAYS = ["2026-10-15", "2026-10-06", "2026-11-06"];
let anyFlagged = false;
for (const day of EVENT_DAYS) {
  const upto = events.filter((e) => e.timestamp.slice(0, 10) <= day);
  const result = analyze(upto);
  const flagged = result.signals.filter((s) => s.flagged);
  if (flagged.length) anyFlagged = true;
  console.log(`\nwindow ending ${day} — state=${result.state} coordinated=${result.coordinated}`);
  for (const s of result.signals) {
    if (s.delta === null) continue;
    const over = Math.abs(s.delta) >= s.threshold ? " (clears threshold)" : "";
    console.log(
      `  ${s.metric.padEnd(13)}${String(s.delta).padStart(7)}% vs ${String(s.threshold).padStart(3)}%` +
        `  flagged=${String(s.flagged).padEnd(5)} ${s.quality}${over}`,
    );
  }
}

console.log("");
if (!anyFlagged) {
  console.log("RESULT: the engine flags nothing on real data.");
  console.log("Signals clear their percent thresholds but fail `b.sufficient`, so");
  console.log("`coordinated` can never become true. See docs/INTEROP.md for four fixes.");
  process.exit(1);
}
console.log("RESULT: the engine flags real data. The baseline gate has been fixed.");
