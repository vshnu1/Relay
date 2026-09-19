"""Command line boundary.

    python -m vesper_ml score < request.json > evidence.json
    python -m vesper_ml synthetic --scenario ambiguous [--context]
    python -m vesper_ml validate-export [--export PATH]   (reads HEALTH_EXPORT_XML)
    python -m vesper_ml train-synthetic
    python -m vesper_ml fixtures

`score` reads one JSON document on stdin and writes one on stdout. It never
touches the filesystem, so a workflow task can shell out to it safely.
"""

import argparse
import json
import sys

from . import MODEL_VERSION
from .programs import PROGRAMS


def _read_stdin_json():
    raw = sys.stdin.read()
    if not raw.strip():
        raise SystemExit("score: expected a JSON request on stdin")
    return json.loads(raw)


def cmd_score(args):
    from .score import score_request

    request = _read_stdin_json()
    result = score_request(request)
    json.dump(result, sys.stdout, indent=None if args.compact else 2)
    sys.stdout.write("\n")
    return 0


def cmd_synthetic(args):
    from . import synthetic

    events, context = synthetic.scenario(args.scenario, anchor_ms=args.anchor_ms, seed=args.seed)
    payload = {
        "events": events,
        "context": context if args.context else None,
        "program": synthetic.SCENARIO_PROGRAM.get(args.scenario, "post_abdominal_surgery"),
    }
    json.dump(payload, sys.stdout)
    sys.stdout.write("\n")
    return 0


def cmd_validate_export(args):
    from .validate_export import run

    return run(export_path=args.export, program=args.program, report=args.report)


def cmd_fixtures(args):
    from .fixtures import write_fixtures

    written = write_fixtures(out_dir=args.out_dir)
    for path in written:
        print(path)
    return 0


def cmd_train_synthetic(args):
    from .train import train_synthetic_prior

    summary = train_synthetic_prior(out_dir=args.out_dir, seed=args.seed)
    json.dump(summary, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def build_parser():
    p = argparse.ArgumentParser(prog="vesper_ml", description=f"Vesper ML ({MODEL_VERSION})")
    sub = p.add_subparsers(dest="command", required=True)

    s = sub.add_parser("score", help="score a JSON request from stdin")
    s.add_argument("--compact", action="store_true")
    s.set_defaults(func=cmd_score)

    s = sub.add_parser("synthetic", help="emit a synthetic scenario request")
    s.add_argument("--scenario", default="ambiguous")
    s.add_argument("--context", action="store_true", help="include the scenario's structured context")
    s.add_argument("--anchor-ms", type=int, default=None)
    s.add_argument("--seed", type=int, default=0)
    s.set_defaults(func=cmd_synthetic)

    s = sub.add_parser("validate-export", help="read-only aggregate validation of a private Apple Health export")
    s.add_argument("--export", default=None, help="path to export.xml; defaults to $HEALTH_EXPORT_XML")
    s.add_argument("--program", default="post_abdominal_surgery", choices=sorted(PROGRAMS))
    s.add_argument("--report", default=None, help="where to write the aggregate JSON report")
    s.set_defaults(func=cmd_validate_export)

    s = sub.add_parser("fixtures", help="write every synthetic scenario request and its expected outcome under ml/fixtures/synthetic")
    s.add_argument("--out-dir", default=None)
    s.set_defaults(func=cmd_fixtures)

    s = sub.add_parser("train-synthetic", help="train and save the synthetic-only prior model")
    s.add_argument("--out-dir", default=None)
    s.add_argument("--seed", type=int, default=0)
    s.set_defaults(func=cmd_train_synthetic)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    return args.func(args)
