import test from "node:test";
import assert from "node:assert/strict";
import {
  dayColumns,
  domain,
  labelEvery,
  niceStep,
  ticks,
} from "../src/recovery/doctor/chartScale.js";

test("value axis uses round steps and stays inside the data", () => {
  assert.equal(niceStep(30), 10);
  assert.equal(niceStep(4.2), 1);
  assert.equal(niceStep(0.9), 0.2);
  assert.deepEqual(ticks(58, 76), [60, 65, 70, 75]);
  const d = domain({
    values: [62, 64, 70],
    usual: 62,
    band: 2,
    threshold: 68.2,
    unit: "bpm",
  });
  assert.ok(d.lo < 60 && d.hi > 70.2, "readings, band and threshold all fit");
});

test("a percentage never charts above 100", () => {
  const d = domain({
    values: [97, 98.5, 99.4],
    usual: 98,
    band: 0.5,
    threshold: 96,
    unit: "%",
  });
  assert.equal(d.hi, 100);
  assert.ok(d.lo < 96);
});

test("day columns keep a narrow hospital-stay column and fill the width", () => {
  const cols = dayColumns(300, 7, 9);
  assert.equal(cols.length, 17);
  assert.ok(cols[7].w < cols[6].w, "the stay column is narrower");
  const last = cols[cols.length - 1];
  assert.ok(Math.abs(last.x + last.w - 300) < 0.01, "columns fill the width");
  assert.equal(labelEvery(30), 1);
  assert.equal(labelEvery(15), 2);
});
