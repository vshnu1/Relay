# Runbook: LifeSnaps cohort analysis

Self-contained instructions for a second machine. Nothing here touches the
application, so it cannot break the demo.

## Why

Two numbers we do not currently have, and both get asked:

1. **How far apart are different people's baselines?** If 71 people's resting
   heart rates span 30 bpm, no single threshold serves them and per-patient
   baselining stops being a design preference. This is the empirical case for
   the product.
2. **How often does the rule fire on people who are fine?** Nobody in
   LifeSnaps is post-surgical, so every trigger is a false alarm. That is a
   false-positive rate, and "we don't know" is a bad answer to a clinical
   judge.

## What you need

Python 3.9+. No third-party packages for the two scripts below. About 3 GB
of disk for the download and its contents.

## Steps

### 1. Clone and get on this branch

```bash
git clone https://github.com/vshnu1/bayhacks.git
cd bayhacks
git checkout Anson
```

### 2. Download LifeSnaps

615 MB, CC-BY-4.0, no registration or data use agreement.

```bash
mkdir -p data/lifesnaps && cd data/lifesnaps
# -C - resumes; the plain download has been seen to die on a TLS error partway
curl -L -C - --retry 10 -o rais.zip "https://zenodo.org/records/7229547/files/rais_anonymized.zip?download=1"
unzip rais.zip
cd ../..
```

The file we want is `daily_fitbit_sema_df_unprocessed.csv`. There is also an
hourly version and MongoDB `.bson` dumps — ignore both, the daily file is
enough and the dumps need a running MongoDB.

`data/` is gitignored, so nothing here can be committed by accident.

### 3. Look at the header before trusting the loader

**Do this first.** `pipeline/load_lifesnaps.py` discovers column names by
matching substrings, and it has never been run against the real file. It
prints what it mapped; check that against reality.

```bash
python3 pipeline/load_lifesnaps.py data/lifesnaps/daily_fitbit_sema_df_unprocessed.csv --inspect
```

### 4. Convert

```bash
python3 pipeline/load_lifesnaps.py \
  data/lifesnaps/daily_fitbit_sema_df_unprocessed.csv \
  fixtures/lifesnaps_daily.csv
```

Read the mapping table it prints. Anything wrong or missing, override it:

```bash
python3 pipeline/load_lifesnaps.py in.csv out.csv \
  --map spo2=oxygen_saturation --map hrv_sdnn=daily_rmssd
```

Expect roughly 71 subjects and a few thousand subject-days. Far fewer means
the mapping is wrong — go back to `--inspect`.

Known name guesses, unverified: `resting_hr`, `rmssd`, `spo2`,
`full_sleep_breathing_rate`, `nremhr`, `sleep_duration`, `steps`, `id`, `date`.

### 5. Run the calibration

```bash
python3 analysis/calibrate.py fixtures/lifesnaps_daily.csv --sweep --json fixtures/calibration.json
```

Two outputs. The population-spread table is the pitch material. The sweep is
the false-positive rate at each threshold — including the 1.5 sd / 2-signal
setting `analysis/detect.py` currently uses.

### 6. Commit only the outputs

```bash
git add fixtures/lifesnaps_daily.csv fixtures/calibration.json
git commit -m "Add LifeSnaps cohort baselines and rule calibration"
git push origin Anson
```

LifeSnaps is already anonymised and CC-BY, so the derived CSV is safe to
commit. **Never commit the 615 MB zip or anything under `data/`.**

## What to report back

- the population spread table, particularly resting HR and HRV
- the fire rate at 1.5 sd / 2 signals, which is what we ship today
- whether a different threshold gives a materially better rate

If the spread between people is much larger than the variation within one
person, say so loudly — that sentence belongs in the pitch.

## If something breaks

**`cannot proceed: no column matched subject, date`** — the header does not
contain anything resembling an id or date column. Run `--inspect` and pass
`--map subject=<column> --map date=<column>`.

**Almost every row skipped** — rows need at least two mapped metrics. Either
the mapping is wrong or you mapped columns that are mostly empty.

**Absurd sleep values** — the loader guesses whether sleep is in minutes or
milliseconds. Check a few raw values and fix `normalise()` if it guessed wrong.

**Fire rate near 0% or near 100%** — near zero usually means the per-subject
series are too short to build baselines from (needs 14 observations per
signal). Near 100% usually means a unit mismatch inflating the deviations.

## Verified: the esbuild install-script warning is not a deploy blocker

`npm ci` prints a warning on npm 11.16+ about `esbuild` having an install
script not covered by `allowScripts`. That warning is real, and `allowScripts`
and `npm approve-scripts` are real npm features — but in npm 11 the field is
**advisory**. Install scripts still run; npm only lists the ones you have not
reviewed. Blocking is scheduled for npm 12.

Tested here rather than assumed:

```
npm ci && npm run build                  -> clean, no allowScripts field present
npm ci --ignore-scripts && npm run build -> clean, built in 1.13s
```

The build survives install scripts being blocked **entirely**, because
esbuild's platform binaries are `optionalDependencies` (`@esbuild/linux-x64`
and 25 others in the lockfile), not something the postinstall downloads. The
postinstall only validates.

So this is not a reason a Render deploy would fail, and `allowScripts` should
not be added to `package.json` as a deploy fix. It is reasonable
future-proofing before npm 12, and nothing more urgent than that.
