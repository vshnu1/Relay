"""Population context for a patient's own baseline.

Optional. If fixtures/cohort_baselines.json is absent, every signal is
annotated with None and nothing else changes — the cohort is a reference, not
a dependency, and the product must work for a patient whose metric nobody has
population data for.

What this adds is one comparison: this patient's baseline of 64, against a
cohort whose baselines run 47 to 79. It is the difference between asserting
that personal baselines matter and showing it beside the number.

It never feeds the model or the state machine. Nothing here can change a
decision; it only says where a patient sits among others.
"""

import json
import os
from pathlib import Path

_DEFAULT = Path(__file__).resolve().parents[2] / "fixtures" / "cohort_baselines.json"
_cache = {}


def load_cohort(path=None):
    """Read the cohort file once. Missing or malformed means no context, not an error."""
    target = Path(path or os.environ.get("VESPER_COHORT") or _DEFAULT)
    key = str(target)
    if key not in _cache:
        try:
            with open(target, encoding="utf-8") as handle:
                _cache[key] = json.load(handle)
        except (OSError, ValueError):
            _cache[key] = None
    return _cache[key]


def percentile_of(value, deciles):
    """Roughly where a value sits in the cohort, from the decile cut points."""
    if value is None or not deciles:
        return None
    for i, cut in enumerate(deciles):
        if value <= cut:
            return i * 10
    return 100


def annotate(signals, path=None):
    """Attach cohort context to each signal in place. Returns a short summary."""
    cohort = load_cohort(path)
    metrics = (cohort or {}).get("metrics", {})
    described, without = 0, []
    for signal in signals:
        entry = metrics.get(signal.get("metric"))
        baseline = (signal.get("baseline") or {}).get("median")
        if not entry:
            signal["cohort"] = None
            without.append(signal.get("metric"))
            continue
        described += 1
        signal["cohort"] = {
            "subjects": entry["subjects"],
            "lowest_baseline": entry["lowest_baseline"],
            "highest_baseline": entry["highest_baseline"],
            "spread": entry["spread"],
            "cohort_median": entry["cohort_median"],
            "spread_ratio": entry.get("spread_ratio"),
            "patient_percentile": percentile_of(baseline, entry.get("deciles")),
            # True where people differ from each other more than they vary day
            # to day, which is where a fixed threshold cannot serve everyone.
            "personal_baseline_matters": bool((entry.get("spread_ratio") or 0) > 1),
            "caveat": entry.get("caveat"),
        }
    if not cohort:
        return None
    return {
        "source": cohort.get("source", {}).get("dataset"),
        "subjects": cohort.get("source", {}).get("subjects_enrolled"),
        "subject_days": cohort.get("subject_days"),
        "metrics_described": described,
        # Named, not counted: a bare count reads as though the program's own
        # metrics have context when the described ones may belong elsewhere.
        "metrics_without_context": without,
        "note": cohort.get("notes"),
    }
