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

// The corpus in fixtures/hardening is the guard's regression set: phrases the
// boundary must let through and phrases it must never let through. It sat in
// the repo unreferenced, which meant the one rule the product cannot get wrong
// had no test holding it in place.
test("every phrase in the hardening corpus lands on the right side of the guard", async () => {
  const { readFile } = await import("node:fs/promises");
  const corpus = JSON.parse(
    await readFile(
      new URL("../fixtures/hardening/agent-safety-cases.json", import.meta.url),
    ),
  );
  assert.ok(
    corpus.allowed.length && corpus.blocked.length,
    "corpus is not empty",
  );
  for (const example of corpus.allowed)
    assert.deepEqual(
      check(example.text),
      [],
      `${example.id} must pass: ${example.text}`,
    );
  for (const example of corpus.blocked) {
    const violations = check(example.text);
    assert.ok(
      violations.length,
      `${example.id} must be caught: ${example.text}`,
    );
    if (example.rules)
      assert.deepEqual(
        [...new Set(violations.map((v) => v.rule))].sort(),
        [...example.rules].sort(),
        `${example.id} must be caught by the rules the corpus names`,
      );
  }
});

// The README claims the Python guard and its Node port agree pattern for
// pattern. That was checked by hand once. This checks it on every run, over
// the same corpus, so the two cannot drift apart unnoticed. Python is not
// needed to build or run the app, so its absence skips rather than fails.
test("the Python guard and the Node port agree phrase for phrase", async (t) => {
  const { readFile } = await import("node:fs/promises");
  const { spawnSync } = await import("node:child_process");
  const root = new URL("../", import.meta.url).pathname;
  const corpus = JSON.parse(
    await readFile(
      new URL("../fixtures/hardening/agent-safety-cases.json", import.meta.url),
    ),
  );
  const phrases = [...corpus.allowed, ...corpus.blocked].map((x) => x.text);
  const script = [
    "import json,sys",
    "sys.path.insert(0, sys.argv[1] + 'analysis')",
    "from language_guard import check",
    "print(json.dumps([sorted({r for r, _ in check(t)}) for t in json.load(sys.stdin)]))",
  ].join("\n");
  const run = spawnSync(
    process.env.PYTHON_BIN || "python3",
    ["-c", script, root],
    {
      input: JSON.stringify(phrases),
      encoding: "utf8",
    },
  );
  if (run.error || run.status !== 0) {
    t.skip(`python3 unavailable: ${run.error?.message || run.stderr}`);
    return;
  }
  const fromPython = JSON.parse(run.stdout);
  const fromNode = phrases.map((text) =>
    [...new Set(check(text).map((v) => v.rule))].sort(),
  );
  assert.deepEqual(
    fromNode,
    fromPython,
    "the two guards disagree on at least one phrase in the corpus",
  );
});
