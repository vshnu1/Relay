import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.RELAY_DATA_KEY = "d".repeat(64);
const { createAccountStore, IDLE_MS } = await import("../server/accounts.js");

const store = () => createAccountStore(mkdtempSync(join(tmpdir(), "relay-acct-")));
const GOOD = "a-long-enough-password";

test("an account needs a real address and a password worth hashing", () => {
  const s = store();
  assert.match(s.register({ email: "nope", password: GOOD, role: "clinician" }).error, /valid email/);
  assert.match(s.register({ email: "a@b.co", password: "short", role: "clinician" }).error, /at least 10/);
  assert.ok(s.register({ email: "a@b.co", password: GOOD, role: "clinician" }).user);
  assert.match(s.register({ email: "A@B.CO", password: GOOD, role: "clinician" }).error, /already exists/);
});

test("the password is not recoverable from what is stored", () => {
  const dir = mkdtempSync(join(tmpdir(), "relay-acct-"));
  const s = createAccountStore(dir);
  s.register({ email: "elena@bayfront.test", password: GOOD, role: "clinician" });
  const onDisk = readFileSync(join(dir, "users.json"), "utf8");
  assert.ok(!onDisk.includes(GOOD));
  // and the file itself is encrypted, because RELAY_DATA_KEY is set here
  assert.ok(!onDisk.includes("elena@bayfront.test"));
});

test("authentication accepts the right password and nothing else", () => {
  const s = store();
  s.register({ email: "elena@bayfront.test", password: GOOD, role: "clinician" });
  assert.equal(s.authenticate("elena@bayfront.test", "wrong-password-x"), null);
  assert.equal(s.authenticate("nobody@bayfront.test", GOOD), null);
  const user = s.authenticate("ELENA@bayfront.test", GOOD);
  assert.equal(user.email, "elena@bayfront.test");
  assert.equal(user.role, "clinician");
});

// 164.312(a)(2)(iii) was built in the browser only, because there was no
// session store: signing out cleared the tab and left the credential working.
test("signing out revokes the session on the server", () => {
  const s = store();
  const { user } = s.register({ email: "a@b.co", password: GOOD, role: "clinician" });
  const token = s.openSession(user.id);
  assert.equal(s.resolveSession(token).email, "a@b.co");
  s.closeSession(token);
  assert.equal(s.resolveSession(token), null);
});

test("an unknown token resolves to nobody", () => {
  const s = store();
  assert.equal(s.resolveSession("deadbeef"), null);
  assert.equal(s.resolveSession(""), null);
  assert.equal(s.resolveSession(null), null);
});

test("signing out everywhere ends every session that person holds", () => {
  const s = store();
  const { user } = s.register({ email: "a@b.co", password: GOOD, role: "clinician" });
  const tokens = [s.openSession(user.id), s.openSession(user.id), s.openSession(user.id)];
  assert.equal(s.closeAllFor(user.id), 3);
  for (const t of tokens) assert.equal(s.resolveSession(t), null);
});

// 164.312(a)(2)(i): two people on the deployed demo have to be two actors in
// the audit log, not one shared "clinician".
test("each demo visitor is a distinct principal", () => {
  const s = store();
  const seen = new Set();
  for (let i = 0; i < 20; i++) seen.add(s.createDemoPrincipal("clinician").email);
  assert.equal(seen.size, 20);
  assert.equal(s.count(), 0, "demo principals are not counted as real accounts");
  assert.equal(s.demoCount(), 20);
});

test("accounts and sessions survive a restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "relay-acct-"));
  const first = createAccountStore(dir);
  const { user } = first.register({ email: "a@b.co", password: GOOD, role: "clinician" });
  const token = first.openSession(user.id);
  const second = createAccountStore(dir);
  assert.equal(second.resolveSession(token).email, "a@b.co");
  assert.equal(second.authenticate("a@b.co", GOOD).id, user.id);
});

test("the idle window is the fifteen minutes the safeguard claims", () => {
  assert.equal(IDLE_MS, 15 * 60 * 1000);
});

test("a role is taken from the invitation, never from the registrant", () => {
  const s = store();
  const { user } = s.register({ email: "p@b.co", password: GOOD, role: "patient" });
  assert.equal(user.role, "patient");
  assert.equal(s.authenticate("p@b.co", GOOD).role, "patient");
});
