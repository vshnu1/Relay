// Who is acting, rather than which of two shared codes they hold.
//
// Two safeguards were unmet for the same reason, and both are marked required
// and not addressable, which means there is no lawful way to skip them:
//
//   164.312(a)(2)(i)  unique user identification
//   164.312(d)        person or entity authentication
//
// The audit log could name a role and a record. It could not name a person, so
// no breach investigation starting from it could ever answer who.
//
// Why this is built here rather than bought. A hosted identity provider is the
// right answer for a real deployment and is named as such on the security page.
// It is the wrong answer for this one: every such provider loads its script from
// its own origin, and this application's content security policy is
// `script-src 'self'` with no third party listed. Relaxing that to put someone
// else's JavaScript on the authentication path of a health application costs
// more than it buys, and on a free tier it buys identity without a business
// associate agreement, so it would not move the compliance position anyway.
//
// The shared access codes are not deleted. They stop being credentials and
// become invitations: a code lets you create an account, or take a demo
// identity, and neither reaches a record on its own.

import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { resolve } from "node:path";
import { readJsonOrSetAside, writeJson } from "./vault.js";

// Cost parameters. N=16384 is the Node default and takes roughly 100ms here,
// which is the point: it is slow on purpose.
const SCRYPT_N = 16384;
const KEY_LENGTH = 64;

// An absolute ceiling and an idle window. The idle window is what makes the
// automatic-logoff row true on the server as well as in the browser: before
// this there was no session store, so signing out cleared the tab and left the
// credential working for anyone else holding it.
export const IDLE_MS = 15 * 60 * 1000;
export const ABSOLUTE_MS = 12 * 60 * 60 * 1000;

const hash = (password, salt) =>
  scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N }).toString("hex");

const sameSecret = (a, b) => {
  const left = Buffer.from(a || "", "utf8");
  const right = Buffer.from(b || "", "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
};

const cleanName = (name) =>
  String(name || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || null;

export function createAccountStore(dataDir) {
  const usersFile = resolve(dataDir, "users.json");
  const sessionsFile = resolve(dataDir, "sessions.json");

  let users = readJsonOrSetAside(usersFile, []);
  let sessions = readJsonOrSetAside(sessionsFile, []);

  const saveUsers = () => writeJson(usersFile, users);
  const saveSessions = () => {
    const now = Date.now();
    sessions = sessions.filter(
      (s) => s.expiresAt > now && s.lastSeenAt + IDLE_MS > now,
    );
    writeJson(sessionsFile, sessions);
  };

  const publicUser = (u) =>
    u && {
      id: u.id,
      email: u.email,
      role: u.role,
      // Who a message is from, and which single record a patient account is for.
      name: u.name || null,
      patientId: u.patientId || null,
      careTeam: u.careTeam || null,
      demo: !!u.demo,
      createdAt: u.createdAt,
    };

  return {
    count: () => users.filter((u) => !u.demo).length,
    demoCount: () => users.filter((u) => u.demo).length,
    sessionCount: () => {
      const now = Date.now();
      return sessions.filter(
        (s) => s.expiresAt > now && s.lastSeenAt + IDLE_MS > now,
      ).length;
    },

    findByEmail: (email) =>
      users.find(
        (u) =>
          u.email.toLowerCase() ===
          String(email || "")
            .trim()
            .toLowerCase(),
      ) || null,

    // Registration is invitation-only: the caller has already proved they hold
    // a role access code. That code chooses the role; it never again reaches a
    // record by itself.
    register({
      email,
      password,
      role,
      careTeam = null,
      demo = false,
      name = null,
      patientId = null,
    }) {
      const clean = String(email || "")
        .trim()
        .toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean))
        return { error: "Enter a valid email address." };
      if (String(password || "").length < 10)
        return { error: "Use a password of at least 10 characters." };
      if (users.some((u) => u.email.toLowerCase() === clean))
        return { error: "An account already exists for that email address." };
      const salt = randomBytes(16).toString("hex");
      const user = {
        id: randomUUID(),
        email: clean,
        salt,
        hash: hash(password, salt),
        role,
        name: cleanName(name),
        patientId: role === "patient" ? patientId : null,
        careTeam,
        demo,
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      saveUsers();
      return { user: publicUser(user) };
    },

    authenticate(email, password) {
      const clean = String(email || "")
        .trim()
        .toLowerCase();
      const user = users.find((u) => u.email.toLowerCase() === clean);
      // Hash anyway when the account does not exist, so a missing account and a
      // wrong password take the same time to answer.
      const salt = user ? user.salt : "0".repeat(32);
      const attempt = hash(String(password || ""), salt);
      if (!user || !sameSecret(attempt, user.hash)) return null;
      return publicUser(user);
    },

    // A standing demo account, created or refreshed at boot. Unlike a per-browser
    // demo principal it keeps one id and one name for good, which is what lets a
    // conversation be between the same two people after either of them signs out
    // and back in, and after the server restarts.
    ensureAccount({ email, password, role, name = null, patientId = null }) {
      const clean = String(email).trim().toLowerCase();
      let user = users.find((u) => u.email.toLowerCase() === clean);
      const salt = user?.salt || randomBytes(16).toString("hex");
      const fields = {
        role,
        name: cleanName(name),
        patientId: role === "patient" ? patientId : null,
        demo: true,
        standing: true,
        salt,
        hash: hash(password, salt),
      };
      if (user) Object.assign(user, fields);
      else {
        user = {
          id: randomUUID(),
          email: clean,
          careTeam: null,
          createdAt: new Date().toISOString(),
          ...fields,
        };
        users.push(user);
      }
      saveUsers();
      return publicUser(user);
    },

    // A distinct principal per browser, so two people exploring the deployed
    // demo at the same time are two different actors in the audit log rather
    // than one shared "clinician".
    createDemoPrincipal(role, { name = null, patientId = null } = {}) {
      const tag = randomBytes(3).toString("hex");
      const salt = randomBytes(16).toString("hex");
      const user = {
        id: randomUUID(),
        email: `demo-${role}-${tag}@relay.invalid`,
        name: cleanName(name),
        patientId: role === "patient" ? patientId : null,
        salt,
        hash: hash(randomBytes(32).toString("hex"), salt),
        role,
        careTeam: null,
        demo: true,
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      saveUsers();
      return publicUser(user);
    },

    openSession(userId) {
      const token = randomBytes(32).toString("hex");
      const now = Date.now();
      sessions.push({
        token,
        userId,
        openedAt: now,
        lastSeenAt: now,
        expiresAt: now + ABSOLUTE_MS,
      });
      saveSessions();
      return token;
    },

    // Returns the acting user and slides the idle window, or null. A session
    // that has gone idle or hit its ceiling is dropped here, which is the
    // revocation that did not exist before.
    resolveSession(token) {
      if (!token) return null;
      const now = Date.now();
      const session = sessions.find((s) => sameSecret(s.token, token));
      if (!session) return null;
      if (session.expiresAt <= now || session.lastSeenAt + IDLE_MS <= now) {
        sessions = sessions.filter((s) => s !== session);
        saveSessions();
        return null;
      }
      session.lastSeenAt = now;
      const user = users.find((u) => u.id === session.userId);
      if (!user) return null;
      return publicUser(user);
    },

    closeSession(token) {
      const before = sessions.length;
      sessions = sessions.filter((s) => !sameSecret(s.token, token));
      if (sessions.length !== before) saveSessions();
      return before !== sessions.length;
    },

    // Every session belonging to one person, for a real sign-out-everywhere and
    // for the break-glass grant to be withdrawable.
    closeAllFor(userId) {
      const before = sessions.length;
      sessions = sessions.filter((s) => s.userId !== userId);
      if (sessions.length !== before) saveSessions();
      return before - sessions.length;
    },

    persist: saveSessions,
  };
}
