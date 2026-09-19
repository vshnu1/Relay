"""Isolation Forest as a second opinion on the deterministic detector.

This is not part of the pipeline and nothing depends on it. It exists so a
claim made in docs/DATA.md is reproducible: that an unsupervised model,
given no thresholds and no rules, independently ranks the same window most
anomalous that analysis/detect.py surfaces. Two unrelated methods agreeing on
one day is worth more than either alone, but only if anyone can re-run it.

It is deliberately kept out of the product. An isolation score is a number
without a reason — it cannot be traced back to the measurement that caused
it, and traceability is the thing the evidence packet is for. The
deterministic rule decides; this only corroborates.

Requires scikit-learn, which the rest of the repo does not:

    python3 -m venv .venv && ./.venv/bin/pip install scikit-learn
    ./.venv/bin/python analysis/isolation_forest.py

Usage:
    python3 analysis/isolation_forest.py [fixtures/windows_deid.csv] [--top 8]
"""
import argparse
import csv
import sys

# Same five signals the deterministic detector uses, same order.
SIGNALS = ["resting_heart_rate", "hr_night", "hrv_sdnn", "respiratory_rate", "spo2"]

# Fixed so the numbers quoted in docs/DATA.md reproduce exactly.
N_ESTIMATORS = 200
CONTAMINATION = 0.05
RANDOM_STATE = 0


def complete_cases(path):
    """Rows where every signal is present. Isolation Forest cannot take gaps."""
    with open(path, encoding="utf-8") as handle:
        rows = [r for r in csv.DictReader(handle) if r.get("hr_samples") not in ("", "0", None)]
    X, kept = [], []
    for row in rows:
        values = [row.get(s, "") for s in SIGNALS]
        if any(v in ("", None) for v in values):
            continue
        try:
            X.append([float(v) for v in values])
        except ValueError:
            continue
        kept.append(row)
    return X, kept, len(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("infile", nargs="?", default="fixtures/windows_deid.csv")
    parser.add_argument("--top", type=int, default=8)
    args = parser.parse_args()

    try:
        from sklearn.ensemble import IsolationForest
    except ImportError:
        sys.exit(
            "scikit-learn is not installed, and the rest of the repo does not need it.\n"
            "  python3 -m venv .venv && ./.venv/bin/pip install scikit-learn\n"
            "  ./.venv/bin/python analysis/isolation_forest.py"
        )

    X, kept, total = complete_cases(args.infile)
    if len(X) < 20:
        sys.exit(f"only {len(X)} complete rows — too few to fit anything meaningful")

    # The headline caveat: requiring all five signals at once throws away most
    # of the data, because each sensor reports at a different rate.
    print(f"{total} windows with wearable data, {len(X)} complete across all "
          f"{len(SIGNALS)} signals ({100*len(X)/total:.0f}%)")
    print(f"fitting IsolationForest(n_estimators={N_ESTIMATORS}, "
          f"contamination={CONTAMINATION}, random_state={RANDOM_STATE})\n")

    model = IsolationForest(n_estimators=N_ESTIMATORS, contamination=CONTAMINATION,
                            random_state=RANDOM_STATE).fit(X)
    scores = model.score_samples(X)

    ranked = sorted(range(len(X)), key=lambda i: scores[i])
    print(f"{'rank':>5}{'date':>13}{'win':>5}{'score':>9}   " +
          "  ".join(s[:12].rjust(8) for s in SIGNALS))
    for rank, i in enumerate(ranked[:args.top], 1):
        row = kept[i]
        cells = "  ".join(f"{float(row[s]):8.2f}" for s in SIGNALS)
        print(f"{rank:>5}{row['date']:>13}{row['window']:>5}{scores[i]:>9.3f}   {cells}")

    top = kept[ranked[0]]
    print(f"\nmost anomalous: {top['date']} window {top['window']}, score {scores[ranked[0]]:.3f}")
    print("Compare against analysis/detect.py, which reaches its answer from "
          "per-signal\nz-scores and a persistence rule, with no model involved.")


if __name__ == "__main__":
    main()
