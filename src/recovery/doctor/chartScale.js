// Pure helpers for the signal charts: a readable value axis and day layout.
// No React here so the arithmetic can be tested on its own.

// A round step size that yields about `target` ticks across `range`.
export function niceStep(range, target = 3) {
  if (!(range > 0)) return 1;
  const raw = range / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const c = raw / power;
  const s = c < 1.5 ? 1 : c < 3.5 ? 2 : c < 7.5 ? 5 : 10;
  return s * power;
}

// The value range a chart shows: every reading, the usual band, and the threshold
// line, with breathing room, never past 100 for a percentage.
export function domain({ values, usual, band, threshold, unit }) {
  const all = [...values, usual - band, usual + band];
  if (threshold !== null && threshold !== undefined) all.push(threshold);
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  const pad = (hi - lo) * 0.18 || Math.abs(usual) * 0.05 || 1;
  lo -= pad;
  hi += pad;
  if (unit === "%" && hi > 100) hi = 100;
  return { lo, hi };
}

// Tick values inside [lo, hi] on a round step.
export function ticks(lo, hi, target = 3) {
  const step = niceStep(hi - lo, target);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step)
    out.push(Number(v.toFixed(6)));
  return out;
}

// Column geometry shared by every chart: 7 days before admission, a narrow
// hospital-stay column, then the days at home. Returns x centres and widths.
export function dayColumns(width, before, home, gap = 3) {
  const stayShare = 0.8;
  const unit = (width - gap * (before + home)) / (before + home + stayShare);
  const cols = [];
  let x = 0;
  for (let i = 0; i < before + 1 + home; i++) {
    const w = i === before ? unit * stayShare : unit;
    cols.push({ x, w, mid: x + w / 2 });
    x += w + gap;
  }
  return cols;
}

// Which day labels to draw so they never collide: every day when there is room,
// otherwise every other day, always keeping the first and last day at home.
export function labelEvery(columnWidth) {
  return columnWidth >= 22 ? 1 : columnWidth >= 12 ? 2 : 3;
}
