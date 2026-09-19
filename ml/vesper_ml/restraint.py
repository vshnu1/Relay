"""Why the system did not escalate.

The product's promise is fewer alerts. That promise is unfalsifiable unless
the system can show which days it considered and declined, and on what
grounds. Silence and inattention look identical from the outside; this makes
them distinguishable.

Every gate below is already evaluated during scoring. Nothing here recomputes
a decision or can change one — it reads the same numbers the state machine
used and reports which test each one failed. A near miss is a day that failed
one gate by one step, and is the most useful thing a clinician can be told
about a quiet patient.
"""

from .metrics import METRICS

# A gate missed by this much or less is reported as a near miss.
SIGNAL_MARGIN = 1
SCORE_MARGIN = 0.1
DEVIATION_MARGIN = 0.3

ESCALATING = ("context_needed", "review_recommended")


def _gate(name, met, required, observed, detail):
    return {"gate": name, "met": bool(met), "required": required, "observed": observed, "detail": detail}


def build_restraint(signals, program, model, dq, application_state, rule_coordinated, is_anomalous, context):
    """A ledger of the gates that held, for a day that did not escalate."""
    flagged = [s for s in signals if s["flagged"]]
    # Signals that moved far enough but did not last long enough, which is the
    # single most common reason a real deviation goes unreported.
    moved_not_persisted = [
        s for s in signals
        if not s["flagged"]
        and s.get("robust_deviation") is not None
        and abs(s["robust_deviation"]) >= program.deviation_threshold
    ]
    near_threshold = [
        s for s in signals
        if not s["flagged"]
        and s.get("robust_deviation") is not None
        and program.deviation_threshold - DEVIATION_MARGIN <= abs(s["robust_deviation"]) < program.deviation_threshold
    ]

    checks = []

    detail = f"{len(flagged)} of {program.min_coordinated} required signals sustained a deviation"
    if moved_not_persisted:
        names = ", ".join(METRICS[s["metric"]].label.lower() for s in moved_not_persisted[:3])
        detail += f". Moved but did not persist: {names}"
    checks.append(_gate("coordinated_signals", len(flagged) >= program.min_coordinated,
                        program.min_coordinated, len(flagged), detail))

    run = int(model.get("terminal_run", 0) or 0)
    checks.append(_gate("persistence", run >= program.min_persistence_windows,
                        program.min_persistence_windows, run,
                        f"longest run of consecutive anomalous windows was {run}"))

    score = model.get("anomaly_score")
    if score is not None:
        checks.append(_gate("anomaly_score", score >= 0.5, 0.5, round(float(score), 3),
                            f"model placed this window at {round(float(score), 3)}, where 0.5 is the threshold"))

    ready, total = dq.get("core_metrics_ready", 0), dq.get("core_metrics_total", 0)
    coverage_detail = f"{ready} of {total} core signals ready, coverage {dq.get('coverage', 'unknown')}"
    if dq.get("missing_core"):
        coverage_detail += f", missing: {', '.join(METRICS[m].label.lower() for m in dq['missing_core'])}"
    checks.append(_gate("data_quality", dq["status"] != "insufficient", "sufficient or partial",
                        dq["status"], coverage_detail))

    if application_state in ESCALATING:
        return {
            "escalated": True,
            "state": application_state,
            "checks": checks,
            "near_miss": False,
            "closest_gate": None,
            "note": "This day was surfaced. The ledger records the gates as evaluated.",
        }

    # How close did the closest gate come? Reported so a quiet day is legible
    # rather than merely silent.
    unmet = [c for c in checks if not c["met"]]
    near, closest = False, None
    for check in unmet:
        if check["gate"] == "coordinated_signals" and check["observed"] >= check["required"] - SIGNAL_MARGIN:
            near, closest = True, check["gate"]
        elif check["gate"] == "persistence" and check["observed"] >= check["required"] - SIGNAL_MARGIN and check["observed"] > 0:
            near, closest = True, check["gate"]
        elif check["gate"] == "anomaly_score" and float(check["observed"]) >= 0.5 - SCORE_MARGIN:
            near, closest = True, check["gate"]
    if not near and near_threshold:
        near, closest = True, "coordinated_signals"
    if closest is None and unmet:
        closest = unmet[0]["gate"]

    if application_state == "insufficient_data":
        missing = ", ".join(METRICS[m].label.lower() for m in dq.get("missing_core", [])) or "core signals"
        return {
            "escalated": False,
            "state": application_state,
            "checks": checks,
            "near_miss": False,
            "closest_gate": "data_quality",
            "signals_approaching_threshold": [],
            "note": f"Not enough reliable data to judge this day. Missing or stale: {missing}. "
                    "This is not a quiet day; it is an unobserved one.",
        }

    note = "No gate was close. Nothing unusual for this patient on this day."
    if near:
        note = "One gate was missed by a single step. Reported so restraint is visible, not assumed."
    elif near_threshold:
        names = ", ".join(METRICS[s["metric"]].label.lower() for s in near_threshold[:3])
        note = f"Approaching the deviation threshold: {names}."

    return {
        "escalated": False,
        "state": application_state,
        "checks": checks,
        "near_miss": near,
        "closest_gate": closest,
        "signals_approaching_threshold": [
            {"metric": s["metric"], "label": METRICS[s["metric"]].label,
             "robust_deviation": s["robust_deviation"], "direction": s["direction"]}
            for s in near_threshold + moved_not_persisted
        ][:4],
        "note": note,
    }
