"""Unsupervised scoring: imputer -> robust scaler -> Isolation Forest.

Training rows are this patient's own history windows, split chronologically
into train / validation / test. The threshold is the validation quantile of
the raw anomaly score (higher = more isolated), so the expected rate of
flagged windows on ordinary days is roughly 1 - quantile. Scores are mapped
to [0, 1] with a logistic centred on the threshold; 0.5 means "at the
threshold". When a patient has too little history, a synthetic-only prior
model is used and labelled as such. Isolation Forest does not provide
feature importance; explanations come from the robust deviations themselves.
"""

import json
import os
import warnings
from dataclasses import dataclass, field

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler

ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "artifacts")
MIN_HISTORY_ROWS = 16
N_ESTIMATORS = 200


@dataclass
class ModelResult:
    status: str  # fitted | prior | unavailable
    threshold: float = None
    scale: float = None
    raw_recent: np.ndarray = None
    scores_recent: np.ndarray = None  # 0..1
    flags_recent: np.ndarray = None
    diagnostics: dict = field(default_factory=dict)


def make_pipeline(seed=0):
    return Pipeline(
        [
            ("impute", SimpleImputer(strategy="median", add_indicator=True)),
            ("scale", RobustScaler()),
            ("forest", IsolationForest(n_estimators=N_ESTIMATORS, random_state=seed, contamination="auto")),
        ]
    )


def chronological_split(n, train_frac=0.6, val_frac=0.2):
    n_train = max(1, int(round(n * train_frac)))
    n_val = max(1, int(round(n * val_frac)))
    n_train = min(n_train, n - 2) if n >= 3 else n_train
    n_val = min(n_val, n - n_train - 1) if n - n_train - 1 >= 1 else max(0, n - n_train)
    idx = np.arange(n)
    return idx[:n_train], idx[n_train : n_train + n_val], idx[n_train + n_val :]


def usable_rows(X, core_columns):
    """Rows with at least one non-missing *core* deviation.

    `core_columns` is a list of column indices (an int means the first n
    columns). Restricting training to windows where a core signal exists keeps
    a long phone-only era from becoming the training set for a program whose
    core signals arrived with a later device; the forest then learns the era
    in which the signals it must judge actually exist."""
    if isinstance(core_columns, (int, np.integer)):
        core_columns = list(range(int(core_columns)))
    if not core_columns:
        return np.ones(len(X), dtype=bool)
    return ~np.all(np.isnan(X[:, list(core_columns)]), axis=1)


def _raw(pipe, X):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return -pipe.decision_function(X)


def _mad_scale(values):
    values = np.asarray(values, dtype=float)
    if len(values) == 0:
        return 1e-3
    med = np.median(values)
    return max(float(np.median(np.abs(values - med))) * 1.4826, 1e-3)


def calibrate(raw_train, raw_val, quantile):
    """Threshold: the validation quantile (floored by the train quantile so a
    tiny validation set cannot lower it). Scale: half the distance from the
    ordinary (median) validation score to the threshold, so a window as far
    above the threshold as ordinary windows sit below it scores about 0.88."""
    thr_val = float(np.quantile(raw_val, quantile)) if len(raw_val) else -np.inf
    thr_train = float(np.quantile(raw_train, quantile)) if len(raw_train) else -np.inf
    threshold = max(thr_val, thr_train)
    ref = raw_val if len(raw_val) >= 4 else raw_train
    scale = max((threshold - float(np.median(ref))) / 2.0, _mad_scale(ref) / 2.0, 1e-3)
    return threshold, scale


def neutralize_missingness(pipe, X, dev_columns, coverage_columns):
    """Counterfactual rows in which absent sensors are simply absent.

    Missing deviation columns are filled with the imputer's own training
    median (so no missingness indicator fires) and the coverage columns are
    set to their training median. A window that is only anomalous because
    sensors stopped reporting scores as ordinary here; a window whose present
    measurements are unusual keeps its score."""
    if X is None or not len(X) or (not dev_columns and not coverage_columns):
        return X
    stats = pipe.named_steps["impute"].statistics_
    Xn = np.array(X, dtype=float, copy=True)
    for j in dev_columns or []:
        if j < len(stats) and not np.isnan(stats[j]):
            col = Xn[:, j]
            col[np.isnan(col)] = stats[j]
    for j in coverage_columns or []:
        if j < len(stats) and not np.isnan(stats[j]):
            Xn[:, j] = stats[j]
    return Xn


def to_scores(raw, threshold, scale):
    z = (np.asarray(raw, dtype=float) - threshold) / scale
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))


def fit_and_score(X_hist, X_recent, core_columns, quantile=0.95, seed=0, prior=None, dev_columns=None, coverage_columns=None, n_deviating_column=None):
    keep = usable_rows(X_hist, core_columns)
    Xh = X_hist[keep]
    diag = {"history_rows": int(len(X_hist)), "usable_history_rows": int(len(Xh)), "feature_dim_in": int(X_hist.shape[1])}
    if len(Xh) and len(Xh) < len(X_hist):
        diag["history_rows_without_core_signals"] = int(len(X_hist) - len(Xh))
    if len(Xh) < MIN_HISTORY_ROWS:
        if prior is not None:
            return _score_with_prior(prior, X_recent, diag, dev_columns, coverage_columns, n_deviating_column)
        diag["reason"] = f"fewer than {MIN_HISTORY_ROWS} usable history windows and no synthetic prior"
        return ModelResult("unavailable", diagnostics=diag)
    tr, va, te = chronological_split(len(Xh))
    pipe = make_pipeline(seed)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pipe.fit(Xh[tr])
    raw_tr, raw_va, raw_te = _raw(pipe, Xh[tr]), _raw(pipe, Xh[va]), (_raw(pipe, Xh[te]) if len(te) else np.array([]))
    threshold, scale = calibrate(raw_tr, raw_va, quantile)
    raw_recent = _raw(pipe, X_recent) if len(X_recent) else np.array([])
    raw_recent, neutral_diag = _net_of_missingness(pipe, X_recent, raw_recent, threshold, dev_columns, coverage_columns, n_deviating_column)
    diag.update(neutral_diag)
    diag.update(
        {
            "n_train": int(len(tr)),
            "n_val": int(len(va)),
            "n_test": int(len(te)),
            "feature_dim_model": int(pipe.named_steps["scale"].n_features_in_),
            "threshold_raw": round(threshold, 4),
            "score_scale_raw": round(scale, 4),
            "val_exceed_rate": round(float(np.mean(raw_va > threshold)), 3) if len(raw_va) else None,
            "test_exceed_rate": round(float(np.mean(raw_te > threshold)), 3) if len(raw_te) else None,
            "quantile": quantile,
            "n_estimators": N_ESTIMATORS,
        }
    )
    return ModelResult("fitted", threshold, scale, raw_recent, to_scores(raw_recent, threshold, scale), raw_recent > threshold, diag)


MIN_DEVIATING_FOR_MISSING = 2  # present core signals beyond threshold needed before missingness may add to a flag


def _net_of_missingness(pipe, X_recent, raw_recent, threshold, dev_columns, coverage_columns, n_deviating_column=None):
    """Missingness may amplify a flag but never originate one.

    Each recent window is also scored as a counterfactual in which absent
    sensors are neutral (their deviation at the training median, coverage at
    its training median). When fewer than MIN_DEVIATING_FOR_MISSING present
    core signals exceed the deviation threshold, the decisive score is
    min(raw, counterfactual): the window must be unusual on what was actually
    measured. When at least that many present signals deviate, the full score
    stands, because sensors that stopped reporting are not what made the
    window unusual. Windows whose flag disappears under the counterfactual
    are counted as explained by missingness."""
    if not len(X_recent) or (not dev_columns and not coverage_columns):
        return raw_recent, {"missingness_neutralized_windows": 0}
    Xn = neutralize_missingness(pipe, X_recent, dev_columns, coverage_columns)
    raw_neutral = _raw(pipe, Xn)
    net = np.minimum(raw_recent, raw_neutral)
    if n_deviating_column is not None:
        enough = np.nan_to_num(X_recent[:, n_deviating_column]) >= MIN_DEVIATING_FOR_MISSING
        decisive = np.where(enough, raw_recent, net)
    else:
        decisive = net
    explained = (raw_recent > threshold) & (decisive <= threshold)
    return decisive, {
        "missingness_neutralized_windows": int(explained.sum()),
        "latest_explained_by_missingness": bool(explained[-1]),
        "latest_raw_with_missingness": round(float(raw_recent[-1]), 4),
        "latest_raw_net_of_missingness": round(float(net[-1]), 4),
        "latest_raw_decisive": round(float(decisive[-1]), 4),
    }


def _score_with_prior(prior, X_recent, diag, dev_columns=None, coverage_columns=None, n_deviating_column=None):
    pipe, meta = prior
    if X_recent.shape[1] != meta["feature_dim_in"]:
        diag["reason"] = "synthetic prior feature dimension does not match this program"
        return ModelResult("unavailable", diagnostics=diag)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            raw = _raw(pipe, X_recent) if len(X_recent) else np.array([])
    except Exception as exc:  # pickled with another scikit-learn release: score nothing rather than guess
        diag["reason"] = f"synthetic prior could not be applied with the installed scikit-learn ({type(exc).__name__})"
        return ModelResult("unavailable", diagnostics=diag)
    thr, scale = meta["threshold_raw"], meta["score_scale_raw"]
    raw, neutral_diag = _net_of_missingness(pipe, X_recent, raw, thr, dev_columns, coverage_columns, n_deviating_column)
    diag.update(neutral_diag)
    diag.update({"prior": meta.get("artifact"), "threshold_raw": thr, "score_scale_raw": scale, "training_data": "synthetic"})
    return ModelResult("prior", thr, scale, raw, to_scores(raw, thr, scale), raw > thr, diag)


def terminal_run(flags):
    """Length of the run of True values ending at the last element, and its start index."""
    flags = np.asarray(flags, dtype=bool)
    n = len(flags)
    if n == 0 or not flags[-1]:
        return 0, None
    i = n - 1
    while i > 0 and flags[i - 1]:
        i -= 1
    return n - i, i


def save_prior(pipe, meta, program_key, out_dir=None):
    import joblib

    out_dir = out_dir or ARTIFACT_DIR
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.join(out_dir, f"synthetic-prior-{program_key}")
    # Compressed: fourteen uncompressed forests are 32 MB of binary in a repo
    # four people clone all day. joblib.load reads either form, so the one
    # artifact saved before this stays readable.
    joblib.dump(pipe, base + ".joblib", compress=3)
    with open(base + ".json", "w") as fh:
        json.dump(meta, fh, indent=2)
    return base + ".joblib", base + ".json"


def load_prior(program_key, artifact_dir=None):
    artifact_dir = artifact_dir or ARTIFACT_DIR
    base = os.path.join(artifact_dir, f"synthetic-prior-{program_key}")
    if not (os.path.exists(base + ".joblib") and os.path.exists(base + ".json")):
        return None
    try:
        import joblib

        with open(base + ".json") as fh:
            meta = json.load(fh)
        if meta.get("training_data") != "synthetic":
            return None
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            pipe = joblib.load(base + ".joblib")
        meta["artifact"] = os.path.basename(base + ".joblib")
        return pipe, meta
    except Exception:  # corrupt or version-incompatible artifact: fall back silently
        return None
