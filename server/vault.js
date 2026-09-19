// What is on disk, and whether anyone can tell it was changed.
//
// Two of the HIPAA technical safeguards are storage properties rather than
// application behaviour, and both were unmet:
//
//   164.312(a)(2)(iv)  encryption at rest    -- plaintext JSON at mode 0600
//   164.312(c)(2)      authenticate ePHI     -- no checksums, no hash chain
//
// This module supplies both, and reports which of them is actually in force so
// the security page can state the live mode rather than the intention.
//
// The key is RELAY_DATA_KEY. With no key set, files are written exactly as
// before: readable, mode 0600, and honestly reported as unencrypted. A key that
// goes missing after files were written encrypted is the one case that cannot
// degrade, because the bytes are unreadable without it; that is said plainly at
// startup rather than discovered on the first request.

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename } from "node:path";

const ALGORITHM = "aes-256-gcm";
const MODE = 0o600;

// A 32-byte key given as hex or base64 is used as it stands. Anything else is
// treated as a passphrase and stretched, which is weaker than a random key
// because the salt has to be fixed for the value to be reproducible across
// restarts. The security page says which of the two happened.
function loadKey() {
  const raw = (process.env.RELAY_DATA_KEY || "").trim();
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw))
    return { key: Buffer.from(raw, "hex"), derived: false };
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) return { key: decoded, derived: false };
  return {
    key: scryptSync(raw, "relay.at-rest.v1", 32),
    derived: true,
  };
}

const loaded = loadKey();
export const KEY_PRESENT = !!loaded;
export const KEY_DERIVED = !!loaded?.derived;

export const encryptionMode = () =>
  loaded
    ? loaded.derived
      ? "aes-256-gcm (stretched passphrase)"
      : "aes-256-gcm"
    : "none";

function seal(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, loaded.key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString("base64"),
    ct: ct.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function open(envelope) {
  const decipher = createDecipheriv(
    ALGORITHM,
    loaded.key,
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  return (
    decipher.update(Buffer.from(envelope.ct, "base64"), undefined, "utf8") +
    decipher.final("utf8")
  );
}

const isEnvelope = (value) =>
  !!value &&
  typeof value === "object" &&
  typeof value.ct === "string" &&
  typeof value.iv === "string" &&
  typeof value.tag === "string";

// A file written encrypted cannot be read back without the key. Saying so at
// the point of failure beats an empty roster that looks like a fresh install.
function requireKeyFor(file) {
  if (loaded) return;
  throw new Error(
    `${file} is encrypted and RELAY_DATA_KEY is not set. Set the same key it was written with, or move the file aside to start fresh.`,
  );
}

// Files that could not be opened with the key this process holds. Empty is the
// normal case and the security page says so; a non-empty list is displayed,
// because starting with an empty account store and saying nothing would be the
// worst of both.
export const unreadable = [];

// Boot reads go through this. A file encrypted under a key we no longer hold is
// a problem to report, not a reason to refuse to start: throwing here killed the
// process at module scope, and the deployment crash-looped behind a 502 every
// time its generated key was rotated. The file is moved aside rather than
// deleted or silently overwritten, so it is still there if the key comes back.
export function readJsonOrSetAside(file, fallback) {
  try {
    return readJson(file, fallback);
  } catch (error) {
    const aside = `${file}.unreadable-${Date.now()}`;
    try {
      renameSync(file, aside);
    } catch {
      // If it cannot even be moved, the report below is still worth making.
    }
    unreadable.push({
      file: basename(file),
      movedTo: basename(aside),
      reason: error.message,
    });
    console.error(
      `[relay] ${basename(file)} could not be read with the current RELAY_DATA_KEY. Moved to ${basename(aside)} and starting empty.`,
    );
    return fallback;
  }
}

export function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  const text = readFileSync(file, "utf8");
  if (!text.trim()) return fallback;
  const parsed = JSON.parse(text);
  if (!isEnvelope(parsed)) return parsed;
  requireKeyFor(file);
  return JSON.parse(open(parsed));
}

export function writeJson(file, value) {
  const payload = JSON.stringify(value);
  const body = loaded ? JSON.stringify(seal(payload)) : payload;
  const temp = `${file}.tmp`;
  writeFileSync(temp, body, { mode: MODE });
  renameSync(temp, file);
}

// The append-only log. Each line carries the digest of the line before it, so a
// line edited or removed after the fact breaks every digest that follows and
// the break is locatable. The digest covers the bytes as written, which means
// the chain stays verifiable by someone holding the file and no key.
const GENESIS = "0".repeat(64);
const digest = (previous, payload) =>
  createHash("sha256").update(`${previous}:${payload}`).digest("hex");

export function lastHash(file) {
  if (!existsSync(file)) return GENESIS;
  const lines = readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
  if (!lines.length) return GENESIS;
  try {
    return JSON.parse(lines[lines.length - 1]).hash || GENESIS;
  } catch {
    return GENESIS;
  }
}

export function appendSealed(file, entry, previous) {
  const inner = JSON.stringify(entry);
  const body = loaded ? seal(inner) : entry;
  const payload = loaded ? body.ct : inner;
  const hash = digest(previous, payload);
  appendFileSync(
    file,
    JSON.stringify({ ...body, prev: previous, hash }) + "\n",
    {
      mode: MODE,
    },
  );
  return hash;
}

export function readSealedLines(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const record = JSON.parse(line);
      if (!isEnvelope(record)) {
        const { prev, hash, ...entry } = record;
        return entry;
      }
      requireKeyFor(file);
      return JSON.parse(open(record));
    });
}

// Walks the chain and reports the first line that does not follow from the one
// before it. This is the part that makes (c)(2) a claim rather than a hope.
export function verifyChain(file) {
  if (!existsSync(file))
    return { ok: true, lines: 0, chained: 0, unchained: 0, brokenAt: null };
  const lines = readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
  let previous = GENESIS;
  let chained = 0;
  let unchained = 0;
  for (let i = 0; i < lines.length; i++) {
    let record;
    try {
      record = JSON.parse(lines[i]);
    } catch {
      return {
        ok: false,
        lines: lines.length,
        chained,
        unchained,
        brokenAt: i + 1,
        reason: "not JSON",
      };
    }
    // Lines written before this log was chained carry no digest. They are
    // history, not tampering, and calling them a break would put a red line on
    // the security page for the one deployment that has been running longest.
    // They are counted and stepped over; verification starts at the first line
    // that claims to be part of a chain.
    if (typeof record.hash !== "string") {
      unchained++;
      continue;
    }
    if (record.prev !== previous)
      return {
        ok: false,
        lines: lines.length,
        chained,
        unchained,
        brokenAt: i + 1,
        reason: "previous digest does not match",
      };
    const payload = isEnvelope(record)
      ? record.ct
      : JSON.stringify(
          Object.fromEntries(
            Object.entries(record).filter(
              ([k]) => k !== "prev" && k !== "hash",
            ),
          ),
        );
    if (digest(previous, payload) !== record.hash)
      return {
        ok: false,
        lines: lines.length,
        chained,
        unchained,
        brokenAt: i + 1,
        reason: "line does not match its own digest",
      };
    previous = record.hash;
    chained++;
  }
  return { ok: true, lines: lines.length, chained, unchained, brokenAt: null };
}
