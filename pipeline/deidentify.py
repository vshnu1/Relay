"""Daily aggregates -> de-identified daily aggregates safe to commit.

HIPAA Safe Harbor treats any date element more specific than a year as an
identifier, and device/source strings can be identifying too. We apply the
standard research approach:

  * a pseudonymous patient id derived by HMAC from a secret that never ships
  * a consistent per-patient date shift, so intervals and weekday structure
    survive but no real date does
  * a study_day index, which is what the analysis layer actually uses
  * source names collapsed to a device class

Interval-preserving shift matters: the deviation engine reasons about
persistence across consecutive days, so we cannot jitter dates independently.

Usage:
    python3 pipeline/deidentify.py data/daily.csv data/daily_deid.csv [--secret KEY]
"""
import argparse
import csv
import hashlib
import hmac
import os
from datetime import date, timedelta

DROP = {"sources"}
SHIFT_RANGE = 365


def pseudonym(subject, secret):
    return hmac.new(secret.encode(), subject.encode(), hashlib.sha256).hexdigest()[:12]


def shift_days(subject, secret):
    """Deterministic per-subject offset. Same secret in, same shift out."""
    digest = hmac.new(secret.encode(), f"shift:{subject}".encode(), hashlib.sha256).digest()
    return int.from_bytes(digest[:4], "big") % SHIFT_RANGE + 1


def deidentify(rows, subject, secret):
    patient_id = pseudonym(subject, secret)
    offset = shift_days(subject, secret)
    anchor = date.fromisoformat(rows[0]["date"])
    out = []
    for row in rows:
        real = date.fromisoformat(row["date"])
        record = {k: v for k, v in row.items() if k not in DROP}
        record["date"] = (real + timedelta(days=offset)).isoformat()
        record["study_day"] = (real - anchor).days
        record["patient_id"] = patient_id
        record["device_class"] = "wrist_wearable" if row.get("hr_samples") not in ("", "0", 0) else "phone_only"
        out.append(record)
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("infile")
    parser.add_argument("outfile")
    parser.add_argument("--subject", default="subject-001")
    parser.add_argument("--secret", default=os.environ.get("DEID_SECRET", "dev-only-not-a-real-secret"))
    args = parser.parse_args()

    with open(args.infile, encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise SystemExit(f"{args.infile} is empty")

    out = deidentify(rows, args.subject, args.secret)
    fields = ["patient_id", "study_day", "date", "device_class"] + [
        f for f in out[0] if f not in {"patient_id", "study_day", "date", "device_class"}
    ]
    with open(args.outfile, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(out)
    print(f"{args.outfile}: {len(out)} rows as patient {out[0]['patient_id']}, dates shifted")
    if args.secret.startswith("dev-only"):
        print("  warning: using the default dev secret. Set DEID_SECRET for anything real.")


if __name__ == "__main__":
    main()
