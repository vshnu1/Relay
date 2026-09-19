import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The module reads RELAY_DATA_KEY once, at import, so each mode needs its own
// import. A query string is the only way to defeat the module cache.
async function load(key) {
  if (key) process.env.RELAY_DATA_KEY = key;
  else delete process.env.RELAY_DATA_KEY;
  return import(`../server/vault.js?case=${Math.random()}`);
}

const dir = () => mkdtempSync(join(tmpdir(), "relay-vault-"));
const RECORD = { patients: [{ id: "maya", note: "shortness of breath" }] };

test("with no key, files are written as before and said to be unencrypted", async () => {
  const v = await load(null);
  const file = join(dir(), "state.json");
  v.writeJson(file, RECORD);
  assert.equal(v.encryptionMode(), "none");
  assert.equal(v.KEY_PRESENT, false);
  assert.ok(readFileSync(file, "utf8").includes("shortness of breath"));
  assert.deepEqual(v.readJson(file, null), RECORD);
});

test("with a key, the record is not readable on disk and still round-trips", async () => {
  const v = await load("a".repeat(64));
  const file = join(dir(), "state.json");
  v.writeJson(file, RECORD);
  assert.equal(v.encryptionMode(), "aes-256-gcm");
  const onDisk = readFileSync(file, "utf8");
  assert.ok(!onDisk.includes("shortness of breath"));
  assert.ok(!onDisk.includes("maya"));
  assert.deepEqual(v.readJson(file, null), RECORD);
});

test("a passphrase is stretched, and says so rather than passing as a key", async () => {
  const v = await load("not a thirty-two byte key at all");
  assert.equal(v.KEY_DERIVED, true);
  assert.match(v.encryptionMode(), /stretched passphrase/);
});

test("the audit chain verifies, and a plaintext file stays readable", async () => {
  const v = await load(null);
  const file = join(dir(), "audit.jsonl");
  let head = v.lastHash(file);
  for (const action of ["record.view", "consent.changed", "handoff.exported"])
    head = v.appendSealed(file, { action }, head);
  assert.deepEqual(
    v.readSealedLines(file).map((l) => l.action),
    ["record.view", "consent.changed", "handoff.exported"],
  );
  const chain = v.verifyChain(file);
  assert.equal(chain.ok, true);
  assert.equal(chain.lines, 3);
});

// This is the whole point of 164.312(c)(2): the log is append-only by
// convention, and nothing stopped anyone editing it afterwards.
test("editing a line after the fact is detected, and located", async () => {
  for (const key of [null, "b".repeat(64)]) {
    const v = await load(key);
    const file = join(dir(), "audit.jsonl");
    let head = v.lastHash(file);
    for (const action of ["a", "b", "c", "d"])
      head = v.appendSealed(file, { action }, head);

    const lines = readFileSync(file, "utf8").trim().split("\n");
    const second = JSON.parse(lines[1]);
    if (second.ct) second.ct = Buffer.from("rewritten").toString("base64");
    else second.action = "something else";
    lines[1] = JSON.stringify(second);
    writeFileSync(file, lines.join("\n") + "\n");

    const chain = v.verifyChain(file);
    assert.equal(chain.ok, false, `edit not caught with key=${!!key}`);
    assert.equal(chain.brokenAt, 2);
  }
});

test("removing a line is detected too", async () => {
  const v = await load(null);
  const file = join(dir(), "audit.jsonl");
  let head = v.lastHash(file);
  for (const action of ["a", "b", "c"]) head = v.appendSealed(file, { action }, head);
  const lines = readFileSync(file, "utf8").trim().split("\n");
  writeFileSync(file, [lines[0], lines[2]].join("\n") + "\n");
  const chain = v.verifyChain(file);
  assert.equal(chain.ok, false);
  assert.equal(chain.brokenAt, 2);
});

test("a chain continues across a restart rather than starting a second one", async () => {
  const v = await load(null);
  const file = join(dir(), "audit.jsonl");
  const first = v.appendSealed(file, { action: "one" }, v.lastHash(file));
  // A fresh process reads the head back off the file.
  assert.equal(v.lastHash(file), first);
  v.appendSealed(file, { action: "two" }, v.lastHash(file));
  assert.equal(v.verifyChain(file).ok, true);
});

test("an encrypted file cannot be read back without its key, and says so", async () => {
  const withKey = await load("c".repeat(64));
  const file = join(dir(), "state.json");
  withKey.writeJson(file, RECORD);
  const without = await load(null);
  assert.throws(() => without.readJson(file, null), /RELAY_DATA_KEY is not set/);
});

// A log that predates the chain is history, not tampering. The deployment that
// has been running longest has the most such lines, and calling them a break
// would paint the security page red for the wrong reason.
test("lines written before the chain existed are counted, not called a break", async () => {
  const v = await load(null);
  const file = join(dir(), "audit.jsonl");
  // Three lines in the old shape: no prev, no hash.
  const legacy = ["record.view", "roster.view", "consent.changed"]
    .map((action) => JSON.stringify({ id: action, action }))
    .join("\n");
  writeFileSync(file, legacy + "\n");

  let head = v.lastHash(file);
  for (const action of ["ml.scored", "handoff.exported"])
    head = v.appendSealed(file, { action }, head);

  const chain = v.verifyChain(file);
  assert.equal(chain.ok, true, chain.reason);
  assert.equal(chain.unchained, 3);
  assert.equal(chain.chained, 2);
  assert.equal(chain.lines, 5);
});

test("a break after the unchained history is still caught", async () => {
  const v = await load(null);
  const file = join(dir(), "audit.jsonl");
  writeFileSync(file, JSON.stringify({ action: "old" }) + "\n");
  let head = v.lastHash(file);
  for (const action of ["a", "b", "c"]) head = v.appendSealed(file, { action }, head);

  const lines = readFileSync(file, "utf8").trim().split("\n");
  const target = JSON.parse(lines[2]);
  target.action = "rewritten";
  lines[2] = JSON.stringify(target);
  writeFileSync(file, lines.join("\n") + "\n");

  const chain = v.verifyChain(file);
  assert.equal(chain.ok, false);
  assert.equal(chain.brokenAt, 3);
});
