"""Train the synthetic-only prior model.

Used when a patient has fewer than MIN_HISTORY_ROWS usable history windows.
Trained exclusively on `synthetic.population`, labelled synthetic in its
metadata, and saved under ml/artifacts. Patients are split chronologically
within themselves and by patient for calibration.
"""

import time
import warnings

import numpy as np

from . import MODEL_VERSION
from .contracts import normalize
from .features import build_features
from .model import N_ESTIMATORS, calibrate, make_pipeline, save_prior, usable_rows, _raw
from .programs import get_program
from .synthetic import CLINICAL_LEVELS, GAIT_LEVELS, POSTOP_LEVELS, population
from .windows import build_grid

ANCHOR = 1789732800000  # fixed so the artifact is reproducible


def levels_for(program):
    """The synthetic population a program's own core metrics can be drawn from.

    Training a program against levels that lack its core metrics produces a
    prior fitted on empty columns, which is worse than having no prior at all:
    it would score confidently from nothing. So the levels are chosen by what
    the program actually counts, and a program whose core is not covered is
    refused rather than trained badly.
    """
    core = set(program.core)
    for levels in (POSTOP_LEVELS, GAIT_LEVELS, CLINICAL_LEVELS):
        if core <= set(levels):
            return levels
    raise ValueError(f"no synthetic levels cover the core metrics of {program.key}: {sorted(core)}")


def train_synthetic_prior(program_key="post_abdominal_surgery", n_patients=40, days=28, seed=0, out_dir=None, levels=None):
    t0 = time.perf_counter()
    program = get_program(program_key)
    levels = levels or levels_for(program)
    patients = population(n_patients, days, ANCHOR, seed, levels=levels)
    rows = []
    for events in patients:
        grid = build_grid(normalize(events), core_metrics=program.core)
        fs = build_features(grid, program)
        hist = grid.history_mask()
        X = fs.X[hist]
        X = X[usable_rows(X, fs.core_columns)]
        rows.append(X)
    n = len(rows)
    n_train, n_val = int(n * 0.6), int(n * 0.2)
    X_train = np.vstack(rows[:n_train])
    X_val = np.vstack(rows[n_train : n_train + n_val])
    X_test = np.vstack(rows[n_train + n_val :])
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pipe = make_pipeline(seed).fit(X_train)
    raw_tr, raw_va, raw_te = _raw(pipe, X_train), _raw(pipe, X_val), _raw(pipe, X_test)
    threshold, scale = calibrate(raw_tr, raw_va, program.validation_quantile)
    meta = {
        "model_version": MODEL_VERSION,
        "program": program.key,
        "training_data": "synthetic",
        "label": "SYNTHETIC ONLY - trained on relay_ml.synthetic.population; contains no real measurements",
        "n_patients": n_patients,
        "core_metrics": list(program.core),
        "patients_train_val_test": [n_train, n_val, n - n_train - n_val],
        "rows_train_val_test": [int(len(X_train)), int(len(X_val)), int(len(X_test))],
        "feature_dim_in": int(X_train.shape[1]),
        "feature_dim_model": int(pipe.named_steps["scale"].n_features_in_),
        "threshold_raw": round(threshold, 4),
        "score_scale_raw": round(scale, 4),
        "val_exceed_rate": round(float(np.mean(raw_va > threshold)), 3),
        "test_exceed_rate": round(float(np.mean(raw_te > threshold)), 3),
        "quantile": program.validation_quantile,
        "n_estimators": N_ESTIMATORS,
        "seed": seed,
        "train_seconds": round(time.perf_counter() - t0, 2),
    }
    paths = save_prior(pipe, meta, program.key, out_dir)
    return {**meta, "artifact": paths[0], "metadata": paths[1]}
