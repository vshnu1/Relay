"""Enforces the system boundary from the build handoff doc.

The product is explicitly not diagnostic, not risk-predictive and not
treatment-recommending. That constraint lives in prose in `first build.md`,
which means the first person to write an LLM prompt can violate it by accident.
This module makes it executable: every string that reaches a clinician should
pass through `check()` first.

The rule from the doc: say why the event was flagged, never why it medically
matters.

Usage:
    python3 analysis/language_guard.py "some candidate summary text"
"""
import re
import sys

# Grouped by the reason each phrasing is out of bounds, so a failure message
# can explain the rule rather than just naming a banned word.
FORBIDDEN = [
    ("diagnostic claim", [
        r"\bhas an? (infection|illness|disease|condition)\b",
        r"\b(is|are) (likely |probably )?(sick|ill|infected|septic)\b",
        r"\bdiagnos(is|ed|tic)\b",
        r"\bsuffering from\b",
    ]),
    ("risk prediction", [
        r"\b(high|elevated|increased|low) risk\b",
        r"\brisk of (deterioration|death|complication|sepsis|failure)\b",
        r"\b(will|likely to) (deteriorate|worsen|develop)\b",
        r"\bpredict(s|ed|ion)? (that )?(the )?patient\b",
    ]),
    ("severity judgement", [
        r"\b(clinically )?(dangerous|critical|severe|alarming|concerning|worrying)\b",
        r"\b(urgent|emergency|life[- ]threatening)\b",
    ]),
    ("treatment recommendation", [
        r"\b(change|adjust|start|stop|increase|decrease) (the )?(medication|dose|dosage|treatment)\b",
        r"\bescalate (treatment|care)\b",
        r"\b(should|must) (be )?(treated|prescribed|admitted)\b",
        r"\brecommend(s|ed)? (that )?(the )?(patient|clinician)\b",
    ]),
    ("autonomous escalation", [
        r"\bcontact the patient immediately\b",
        r"\bcall (911|emergency)\b",
        r"\bnotify .{0,20}immediately\b",
    ]),
]

COMPILED = [(rule, [re.compile(p, re.I) for p in pats]) for rule, pats in FORBIDDEN]


class LanguageBoundaryError(ValueError):
    """Raised when generated text crosses the documented system boundary."""


def check(text):
    """Return a list of (rule, matched_text). Empty list means the text is clean."""
    violations = []
    for rule, patterns in COMPILED:
        for pattern in patterns:
            match = pattern.search(text)
            if match:
                violations.append((rule, match.group(0)))
    return violations


def enforce(text):
    """Return text unchanged, or raise. Wrap every clinician-facing string in this."""
    violations = check(text)
    if violations:
        detail = "; ".join(f"{rule}: {repr(hit)}" for rule, hit in violations)
        raise LanguageBoundaryError(
            f"text crosses the documented system boundary ({detail}). "
            "State what deviated and by how much, not what it means medically."
        )
    return text


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    text = " ".join(sys.argv[1:])
    violations = check(text)
    if not violations:
        print("pass — no boundary violations")
        return
    print(f"fail — {len(violations)} violation(s)")
    for rule, hit in violations:
        print(f"  {rule:<28}{hit!r}")
    sys.exit(1)


if __name__ == "__main__":
    main()
