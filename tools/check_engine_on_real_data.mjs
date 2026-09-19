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

// Density is a property of events, not of calendar days: at 6-hour windows
// a metric can contribute up to four samples a day. Report measured density,
// then let the engine itself say whether each baseline is usable.
console.log("\nmeasured density");
console.log(`${"metric".padEnd(14)}${"events".padStart(8)}${"per day".padStart(9)}${"per 14d".padStart(9)}  vs the 12-sample gate`);
const spanDays = (Date.parse(days.at(-1)) - Date.parse(days[0])) / 86400000 + 1;
for (const metric of Object.keys(METRICS)) {
  const n = events.filter((e) => e.metric === metric).length;
  if (!n) {
    console.log(`${metric.padEnd(14)}${String(0).padStart(8)}${"—".padStart(9)}${"—".padStart(9)}  not collected`);
    continue;
  }
  const per14 = (n / spanDays) * 14;
  console.log(
    `${metric.padEnd(14)}${String(n).padStart(8)}${(n / spanDays).toFixed(2).padStart(9)}${per14.toFixed(1).padStart(9)}` +
      `  ${per14 >= 12 ? "clears it on average" : "below it — genuinely sparse"}`,
  );
}

const norm = normalize(events);
const cadence = cadenceHours(norm);
console.log(`\nobserved cadence: ${cadence}h ${cadence === 6 ? "(matches what the engine is tuned for)" : "(the engine is tuned for 6h)"}`);

// Average density clearing the gate does not mean every 14-day window does.
// Ask the engine which baselines it can actually use on the full series.
const base = calculateBaseline(norm);
console.log("\nbaselines the engine can use on the full series");
for (const [metric, b] of Object.entries(base)) {
  if (b.mean === null) continue;
  console.log(`  ${metric.padEnd(13)}n=${String(b.count).padStart(3)}  sufficient=${b.sufficient}`);
}

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
  console.log("Signals clear their percent thresholds and are still not flagged, because");
  console.log("`b.sufficient` or `fresh` fails on that window. See docs/INTEROP.md.");
  process.exit(1);
}
console.log("RESULT: the engine flags real data. The baseline gate has been fixed.");
