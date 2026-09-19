// The clinical boundary, enforced where generated prose leaves the server.
//
// A port of analysis/language_guard.py, kept pattern-for-pattern identical so a
// string that passes here passes there. Until now the guard was a script someone
// remembered to run; the pitch said "enforced in code" and it was enforced by
// habit. This is the difference.
//
// Redact, do not reject. The regexes are deliberately dumb — they flag "this is
// not a diagnosis" as readily as "this is a diagnosis" — so failing a whole score
// because a sentence tripped one would be brittle. The numbers stay; the prose is
// replaced with a sentence that only says what changed, and the redaction is
// recorded so the UI and the audit log both know a sentence was withheld.

const RULES = [
  [
    "diagnostic claim",
    [
      /\bhas an? (infection|illness|disease|condition)\b/i,
      /\b(is|are) (likely |probably )?(sick|ill|infected|septic)\b/i,
      /\bdiagnos(is|ed|tic)\b/i,
      /\bsuffering from\b/i,
    ],
  ],
  [
    "risk prediction",
    [
      /\b(high|elevated|increased|low) risk\b/i,
      /\brisk of (deterioration|death|complication|sepsis|failure)\b/i,
      /\b(will|likely to) (deteriorate|worsen|develop)\b/i,
      /\bpredict(s|ed|ion)? (that )?(the )?patient\b/i,
    ],
  ],
  [
    "severity judgement",
    [
      /\b(clinically )?(dangerous|critical|severe|alarming|concerning|worrying)\b/i,
      /\b(urgent|emergency|life[- ]threatening)\b/i,
    ],
  ],
  [
    "treatment recommendation",
    [
      /\b(change|adjust|start|stop|increase|decrease) (the )?(medication|dose|dosage|treatment)\b/i,
      /\bescalate (treatment|care)\b/i,
      /\b(should|must) (be )?(treated|prescribed|admitted)\b/i,
      /\brecommend(s|ed)? (that )?(the )?(patient|clinician)\b/i,
    ],
  ],
  [
    "autonomous escalation",
    [
      /\bcontact the patient immediately\b/i,
      /\bcall (911|emergency)\b/i,
      /\bnotify .{0,20}immediately\b/i,
    ],
  ],
];

// What stands in for a withheld sentence. It must itself pass the guard.
export const FALLBACK =
  "Some readings moved from this patient's usual. The measurements below show which, by how much, and for how long.";

export function check(text) {
  if (typeof text !== "string" || !text) return [];
  const violations = [];
  for (const [rule, patterns] of RULES)
    for (const re of patterns) {
      const m = text.match(re);
      if (m) violations.push({ rule, hit: m[0] });
    }
  return violations;
}

// Walk the evidence object's prose fields. Returns a new object with any
// offending string replaced, plus a list of what was withheld and from where.
export function guardEvidence(evidence) {
  const withheld = [];
  const guardField = (obj, key, path) => {
    if (!obj || typeof obj[key] !== "string") return;
    const v = check(obj[key]);
    if (v.length) {
      withheld.push({ path, violations: v });
      obj[key] = FALLBACK;
    }
  };
  const out = structuredClone(evidence);
  guardField(out, "summary", "summary");
  guardField(out, "headline", "headline");
  if (out.restraint) {
    guardField(out.restraint, "note", "restraint.note");
    for (const [i, c] of (out.restraint.checks || []).entries())
      guardField(c, "detail", `restraint.checks[${i}].detail`);
  }
  for (const [i, n] of (out.protocol_notes || []).entries())
    if (typeof n === "string" && check(n).length) {
      withheld.push({ path: `protocol_notes[${i}]`, violations: check(n) });
      out.protocol_notes[i] = FALLBACK;
    }
  out.guard = { checked: true, withheld };
  return out;
}
