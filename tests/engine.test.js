import test from "node:test";
import assert from "node:assert/strict";
import {
  analyze,
  simulate,
  normalize,
  HOUR,
  fhirBundle,
} from "../shared/engine.js";
test("persistent coordinated deviations request context and cite measurements", () => {
  const result = analyze(simulate());
  assert.equal(result.state, "context");
  assert.equal(result.signals.filter((s) => s.flagged).length, 5);
  assert.ok(
    result.signals
      .filter((s) => s.flagged)
      .every((s) => s.duration === 36 && s.sourceIds.length === 7),
  );
});
test("isolated workout fluctuation does not trigger review", () =>
  assert.equal(analyze(simulate("explained")).state, "quiet"));
test("check-in adds facts without changing statistical results", () => {
  const events = simulate();
  const before = analyze(events);
  const after = analyze(events, {
    exercise: "No unusual activity",
    fatigue: "Worsening",
    medication: "No changes",
    notes: "Had a soda after soccer practice.",
  });
  assert.equal(after.state, "review");
  assert.deepEqual(before.signals, after.signals);
  assert.match(after.summary, /fatigue — Worsening/);
  assert.match(after.summary, /soda after soccer practice/);
});
test("missing history and gaps do not imply persistent deviation", () => {
  const events = simulate();
  assert.equal(analyze(events.slice(-42)).state, "quiet");
  const end = Date.parse(events.at(-1).timestamp);
  const gappy = events.filter(
    (e) =>
      Date.parse(e.timestamp) < end - 36 * HOUR ||
      Date.parse(e.timestamp) >= end - 6 * HOUR,
  );
  assert.equal(analyze(gappy).state, "quiet");
});
test("normalizer rejects unsupported units, duplicates, and ambiguous dates", () => {
  const e = simulate()[0];
  assert.throws(() => normalize([{ ...e, unit: "other" }]), /expected unit/);
  assert.throws(() => normalize([e, e]), /duplicate/);
  assert.throws(
    () => normalize([{ ...e, timestamp: "2026-09-18" }]),
    /timezone/,
  );
  assert.throws(() => normalize([{ ...e, value: NaN }]), /invalid/);
});
test("daily wearable cadence supports honest multi-day persistence", () => {
  const events = simulate().map((e) => ({
    ...e,
    timestamp: new Date(
      Date.parse(e.timestamp) * 4 - 3 * Date.parse(simulate().at(-1).timestamp),
    ).toISOString(),
  }));
  const result = analyze(events);
  assert.equal(result.cadenceHours, 24);
  assert.equal(result.windowHours, 72);
  assert.equal(result.state, "context");
});
test("mock FHIR observations retain original timestamp and value", () => {
  const events = simulate();
  const p = { id: "demo-01", evidence: analyze(events) };
  const observations = fhirBundle(p).entry.filter(
    (e) => e.resource.resourceType === "Observation",
  );
  assert.equal(observations.length, 35);
  for (const { resource } of observations) {
    const source = events.find((e) => e.id === resource.id);
    assert.equal(resource.effectiveDateTime, source.timestamp);
    assert.equal(resource.valueQuantity.value, source.value);
  }
});
