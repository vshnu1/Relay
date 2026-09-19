import test from "node:test";
import assert from "node:assert/strict";
import { check, guardEvidence, FALLBACK } from "../server/languageGuard.js";

test("the sentence the doc allows passes; the one it forbids fails on the same rules", () => {
  assert.deepEqual(
    check(
      "Resting heart rate is 14% above the patient's baseline for 36 hours.",
    ),
    [],
  );
  const v = check(
    "The patient has an infection and is at high risk of deterioration.",
  );
  assert.deepEqual(
    v.map((x) => x.rule),
    ["diagnostic claim", "risk prediction", "risk prediction"],
  );
});

test("the fallback passes its own guard, or redaction would loop", () => {
  assert.deepEqual(check(FALLBACK), []);
});

test("a tripped sentence is replaced and recorded; the numbers are untouched", () => {
  const evidence = {
    application_state: "context_needed",
    anomaly_score: 0.71,
    summary: "This patient is likely septic and should be admitted.",
    signals: [{ metric: "rhr", value: 78 }],
    restraint: {
      note: "No gate was close.",
      checks: [{ gate: "persistence", detail: "run of 2, dangerous trend" }],
    },
    protocol_notes: ["Patient reported fever symptoms."],
  };
  const g = guardEvidence(evidence);
  assert.equal(g.summary, FALLBACK);
  assert.equal(g.restraint.checks[0].detail, FALLBACK);
  assert.equal(g.restraint.note, "No gate was close.");
  assert.equal(g.protocol_notes[0], "Patient reported fever symptoms.");
  assert.equal(g.anomaly_score, 0.71);
  assert.deepEqual(g.signals, [{ metric: "rhr", value: 78 }]);
  assert.deepEqual(
    g.guard.withheld.map((w) => w.path),
    ["summary", "restraint.checks[0].detail"],
  );
  // The input is not mutated: the audit log gets the original wording.
  assert.match(evidence.summary, /septic/);
});

test("clean evidence passes through with an empty ledger", () => {
  const g = guardEvidence({
    summary: "Two of five signals moved together.",
    signals: [],
  });
  assert.equal(g.summary, "Two of five signals moved together.");
  assert.deepEqual(g.guard, { checked: true, withheld: [] });
});
