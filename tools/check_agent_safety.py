#!/usr/bin/env python3
"""Regression-check the language boundary used for AI-generated summaries."""

from __future__ import annotations

import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from analysis.language_guard import check  # noqa: E402


CASES_PATH = REPO_ROOT / "fixtures" / "hardening" / "agent-safety-cases.json"


def main() -> None:
    cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    failures = []

    for case in cases["allowed"]:
        violations = check(case["text"])
        if violations:
            failures.append(
                f"allowed case {case['id']!r} was blocked: "
                + ", ".join(rule for rule, _ in violations)
            )

    for case in cases["blocked"]:
        observed = {rule for rule, _ in check(case["text"])}
        missing = set(case["rules"]) - observed
        if missing:
            failures.append(
                f"blocked case {case['id']!r} missed: {', '.join(sorted(missing))}"
            )

    if failures:
        for failure in failures:
            print(f"fail — {failure}", file=sys.stderr)
        raise SystemExit(1)

    total = len(cases["allowed"]) + len(cases["blocked"])
    print(f"pass — {total} agent-language boundary cases")


if __name__ == "__main__":
    main()
