// Turning what a patient typed or said into one of the options their care team
// will read.
//
// This is the seam where a sentence becomes a clinical fact, so it is the one
// place in the product where a wrong guess is worse than no guess. The previous
// version matched bare substrings in a fixed order and inverted answers:
//
//   "No, I have taken everything as prescribed."  ->  medicines missed: Yes
//
// because "i have" appears inside it and the Yes branch ran before the No
// branch. The same matching read "no" out of "nothing", "know" and "cannot",
// and turned "not worse" into "A lot" on the strength of the word "worse".
//
// Three rules now: match on whole words, let the opening word decide when the
// rest of the sentence disagrees with it, and return null rather than guess.
// An unclassified answer is offered back to the patient as buttons; a
// misclassified one is never seen again by anyone.

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Whole-word (or whole-phrase) containment, so "no" does not match "nothing".
const contains = (t, phrase) =>
  new RegExp(`(^|[^a-z'])${escape(phrase)}($|[^a-z'])`).test(t);

const NEGATION =
  /(^|[^a-z'])(no|not|never|nothing|none|nowhere|neither|haven't|havent|hasn't|hasnt|hadn't|hadnt|didn't|didnt|don't|dont|doesn't|doesnt|isn't|isnt|wasn't|wasnt|can't|cant|cannot)($|[^a-z'])/;

const OPENS_NO = /^\s*(no|nope|nah|none|not really|not at all|not since)\b/;
const OPENS_YES = /^\s*(yes|yeah|yep|yup|correct|that's right|thats right)\b/;

// A qualifier the patient chose beats a bare comparison they used in passing:
// "a little worse" is a little, not a lot, though it contains "worse".
const STRONG = ["a lot", "lot", "much", "very", "really", "badly", "far"];
const MILD = [
  "a little",
  "little",
  "a bit",
  "bit",
  "slight",
  "slightly",
  "somewhat",
  "a touch",
  "kind of",
  "some",
];
const COMPARATIVE = ["worse", "harder", "heavier", "more"];
const UNSURE = [
  "not sure",
  "unsure",
  "don't know",
  "dont know",
  "do not know",
  "not know",
  "no idea",
  "maybe",
  "hard to say",
  "can't tell",
  "cant tell",
  "cannot tell",
  "difficult to say",
];
const AFFIRM = ["yes", "yeah", "yep", "yup", "correct"];
const WEAK_AFFIRM = ["i have", "i did", "i am", "i've", "i do"];
const DENY = [
  "no",
  "not",
  "nope",
  "nah",
  "not really",
  "none",
  "nothing",
  "haven't",
  "havent",
  "didn't",
  "didnt",
  "never",
  "same",
  "as usual",
  "no change",
  "unchanged",
];

export function matchOption(text, options) {
  const t = (text || "").trim().toLowerCase();
  if (!t) return null;
  const opts = options || [];

  const direct = opts.find((o) => o.toLowerCase() === t);
  if (direct) return direct;

  const has = (list) => list.some((phrase) => contains(t, phrase));
  const can = (option) => opts.includes(option);
  const negated = NEGATION.test(t);

  // "I'm not sure" contains "not", so this has to be read before the denial.
  if (can("Not sure") && has(UNSURE)) return "Not sure";

  // What the sentence opens with wins. "No, I have taken everything as
  // prescribed" is a no, whatever follows the comma.
  if (OPENS_NO.test(t) && can("No")) return "No";
  if (OPENS_YES.test(t) && can("Yes")) return "Yes";

  // A negated intensity is not an intensity: "not worse", "no more tired".
  if (!negated) {
    if (can("A lot") && has(STRONG)) return "A lot";
    if (can("A little") && has(MILD)) return "A little";
    if (can("A lot") && has(COMPARATIVE)) return "A lot";
  }

  if (can("Yes") && has(AFFIRM)) return "Yes";
  if (can("Yes") && !negated && has(WEAK_AFFIRM)) return "Yes";
  if (can("No") && has(DENY)) return "No";

  // A scale question answered with a plain "yes" says something happened but
  // not how much. Better to ask than to pick a severity on the patient's behalf.
  return null;
}
