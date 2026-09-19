"""Synthetic fixtures: one request per scenario plus the expected outcome.

All fixtures are generated from `relay_ml.synthetic` with a fixed anchor and
seed. They contain no real measurements and are safe to commit.
"""

import json
import os

from .score import score_request
from .synthetic import SCENARIO_PROGRAM, SCENARIOS, scenario

FIXTURE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fixtures", "synthetic")
ANCHOR = 1789732800000  # 2026-09-18T12:00:00Z
SEED = 0


def build_fixture(name):
    events, context = scenario(name, ANCHOR, SEED)
    program = SCENARIO_PROGRAM[name]
    without = score_request({"events": events, "context": None, "program": program}, seed=SEED)
    with_ctx = score_request({"events": events, "context": context, "program": program}, seed=SEED) if context else None
    return {
        "scenario": name,
        "synthetic": True,
        "request": {"events": events, "context": None, "program": program, "analyzedThrough": without["analyzedThrough"]},
        "context": context,
        "expected": {
            "without_context": _expect(without),
            "with_context": _expect(with_ctx) if with_ctx else None,
        },
    }


def _expect(r):
    return {
        "application_state": r["application_state"],
        "state": r["state"],
        "coordinated": r["coordinated"],
        "is_anomalous": r["is_anomalous"],
        "rule_coordinated": r["rule_coordinated"],
        "data_quality_status": r["data_quality"]["status"],
        "flagged": sorted(s["metric"] for s in r["signals"] if s["flagged"]),
        "missing": sorted(m["metric"] for m in r["missing_signals"]),
        "model_status": r["model"]["status"],
    }


def write_fixtures(out_dir=None):
    out_dir = out_dir or FIXTURE_DIR
    os.makedirs(out_dir, exist_ok=True)
    written = []
    index = {}
    for name in SCENARIOS:
        fx = build_fixture(name)
        path = os.path.join(out_dir, f"{name}.json")
        with open(path, "w") as fh:
            json.dump(fx, fh, separators=(",", ":"))
        written.append(path)
        index[name] = {"program": SCENARIO_PROGRAM[name], "events": len(fx["request"]["events"]), **fx["expected"]}
    path = os.path.join(out_dir, "expected.json")
    with open(path, "w") as fh:
        json.dump(index, fh, indent=2)
    written.append(path)
    return written


def load_fixture(name, fixture_dir=None):
    with open(os.path.join(fixture_dir or FIXTURE_DIR, f"{name}.json")) as fh:
        return json.load(fh)
