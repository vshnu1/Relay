// Apple Health export, read entirely in the browser. Nothing is uploaded.
//
// The Health app produces export.zip with export.xml inside. The zip is read from
// its central directory, export.xml is inflated with the browser's own
// DecompressionStream, and the XML is scanned as text for <Record> lines of the
// types Relay uses. Each record is bucketed into a local day and reduced to one
// value per day, which is what the watch profiles compare against.

// HK type -> [signal, unit accepted -> multiplier, reduce]
export const TYPES = {
  HKQuantityTypeIdentifierRestingHeartRate: [
    "restingHr",
    { "count/min": 1 },
    "mean",
  ],
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: ["hrv", { ms: 1 }, "mean"],
  HKQuantityTypeIdentifierRespiratoryRate: [
    "breathing",
    { "count/min": 1 },
    "mean",
  ],
  HKQuantityTypeIdentifierOxygenSaturation: ["oxygen", { "%": 100 }, "mean"],
  HKQuantityTypeIdentifierWalkingHeartRateAverage: [
    "walkingHr",
    { "count/min": 1 },
    "mean",
  ],
  HKQuantityTypeIdentifierHeartRate: ["avgHr", { "count/min": 1 }, "mean"],
  HKQuantityTypeIdentifierAppleSleepingWristTemperature: [
    "skinTemp",
    { degC: 1 },
    "mean",
  ],
  HKQuantityTypeIdentifierBodyMass: [
    "weight",
    { kg: 1, lb: 0.45359237 },
    "last",
  ],
  HKQuantityTypeIdentifierBodyTemperature: [
    "temperature",
    { degC: 1, degF: null },
    "mean",
  ],
  HKQuantityTypeIdentifierWalkingSpeed: [
    "walkingSpeed",
    { "m/s": 1, "km/hr": 0.2777778, "mi/hr": 0.44704 },
    "mean",
  ],
  HKQuantityTypeIdentifierWalkingStepLength: [
    "stepLength",
    { cm: 1, in: 2.54, m: 100 },
    "mean",
  ],
  HKQuantityTypeIdentifierWalkingAsymmetryPercentage: [
    "asymmetry",
    { "%": 100 },
    "mean",
  ],
  HKQuantityTypeIdentifierWalkingDoubleSupportPercentage: [
    "doubleSupport",
    { "%": 100 },
    "mean",
  ],
  HKQuantityTypeIdentifierAppleWalkingSteadiness: [
    "steadiness",
    { "%": 100 },
    "mean",
  ],
  HKQuantityTypeIdentifierStepCount: ["steps", { count: 1 }, "sum"],
  HKCategoryTypeIdentifierSleepAnalysis: ["sleep", null, "sum-hours"],
};
const ASLEEP =
  /SleepAnalysisAsleep(Core|Deep|REM|Unspecified)?$|SleepAnalysisAsleep$/;
const ATTR = (name, line) => {
  const i = line.indexOf(` ${name}="`);
  if (i < 0) return null;
  const start = i + name.length + 3;
  return line.slice(start, line.indexOf('"', start));
};
const DAY = 86400000;

// "2026-09-18 12:10:00 -0400" -> epoch ms
function hkTime(s) {
  if (!s) return NaN;
  const m =
    /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d) ([+-])(\d\d)(\d\d)$/.exec(s);
  if (!m) return NaN;
  const utc = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  const off = (m[7] === "-" ? -1 : 1) * (+m[8] * 60 + +m[9]) * 60000;
  return utc - off;
}
// The record's own local day (its offset), as a key and as local noon in this browser.
function localDay(s) {
  return s.slice(0, 10);
}

export function createScanner() {
  const days = {}; // signal -> dayKey -> {sum, n, last, lastT}
  const counts = {};
  let scanned = 0;
  function add(signal, day, v, t, reduce) {
    const bySignal = (days[signal] ||= {});
    const cell = (bySignal[day] ||= { sum: 0, n: 0, last: null, lastT: 0 });
    cell.sum += v;
    cell.n += 1;
    if (t >= cell.lastT) {
      cell.last = v;
      cell.lastT = t;
    }
    counts[signal] = (counts[signal] || 0) + 1;
  }
  return {
    line(line) {
      if (!line.includes("<Record ")) return;
      scanned++;
      const type = ATTR("type", line);
      const def = TYPES[type];
      if (!def) return;
      const [signal, units, reduce] = def;
      const start = ATTR("startDate", line);
      if (!start) return;
      const t = hkTime(start);
      if (Number.isNaN(t)) return;
      if (reduce === "sum-hours") {
        if (!ASLEEP.test(ATTR("value", line) || "")) return;
        const end = hkTime(ATTR("endDate", line));
        if (Number.isNaN(end) || end <= t) return;
        // A night belongs to the day it ends on.
        add(
          signal,
          localDay(ATTR("endDate", line)),
          (end - t) / 3600000,
          t,
          reduce,
        );
        return;
      }
      const unit = ATTR("unit", line);
      let mult = units[unit];
      if (mult === null && unit === "degF") mult = "f";
      if (mult === undefined) return;
      let v = Number(ATTR("value", line));
      if (!Number.isFinite(v)) return;
      v = mult === "f" ? ((v - 32) * 5) / 9 : v * mult;
      add(signal, localDay(start), v, t, reduce);
    },
    result() {
      const readings = {};
      for (const [signal, bySignal] of Object.entries(days)) {
        const reduce = Object.values(TYPES).find((d) => d[0] === signal)[2];
        readings[signal] = Object.entries(bySignal)
          .map(([day, c]) => ({
            t: new Date(`${day}T12:00:00`).getTime(),
            v: Number(
              (reduce === "last"
                ? c.last
                : reduce === "sum-hours" || reduce === "sum"
                  ? c.sum
                  : c.sum / c.n
              ).toFixed(3),
            ),
          }))
          .sort((a, b) => a.t - b.t);
      }
      return {
        readings,
        summary: {
          recordsScanned: scanned,
          recordsUsed: counts,
          daysBySignal: Object.fromEntries(
            Object.entries(readings).map(([s, list]) => [s, list.length]),
          ),
          firstDay: Math.min(
            ...Object.values(readings)
              .flat()
              .map((r) => r.t),
            Infinity,
          ),
          lastDay: Math.max(
            ...Object.values(readings)
              .flat()
              .map((r) => r.t),
            -Infinity,
          ),
        },
      };
    },
  };
}

// ---- zip reading -----------------------------------------------------------

const u32 = (dv, o) => dv.getUint32(o, true);
const u16 = (dv, o) => dv.getUint16(o, true);

// Find export.xml in the central directory and return its compressed bytes + method.
export async function locateEntry(blob, wanted = /(^|\/)export\.xml$/) {
  const tailLen = Math.min(blob.size, 65557 + 22);
  const tail = new DataView(
    await blob.slice(blob.size - tailLen).arrayBuffer(),
  );
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--)
    if (u32(tail, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error("This is not a zip file.");
  const entries = u16(tail, eocd + 10);
  const cdSize = u32(tail, eocd + 12);
  const cdOffset = u32(tail, eocd + 16);
  if (cdOffset === 0xffffffff)
    throw new Error("Zip64 archives are not supported yet.");
  const cd = new DataView(
    await blob.slice(cdOffset, cdOffset + cdSize).arrayBuffer(),
  );
  let o = 0;
  const dec = new TextDecoder();
  for (let i = 0; i < entries && o + 46 <= cd.byteLength; i++) {
    if (u32(cd, o) !== 0x02014b50) break;
    const method = u16(cd, o + 10);
    const csize = u32(cd, o + 20);
    const usize = u32(cd, o + 24);
    const nameLen = u16(cd, o + 28);
    const extraLen = u16(cd, o + 30);
    const commentLen = u16(cd, o + 32);
    const offset = u32(cd, o + 42);
    const name = dec.decode(
      new Uint8Array(cd.buffer, cd.byteOffset + o + 46, nameLen),
    );
    o += 46 + nameLen + extraLen + commentLen;
    if (!wanted.test(name)) continue;
    const local = new DataView(
      await blob.slice(offset, offset + 30).arrayBuffer(),
    );
    if (u32(local, 0) !== 0x04034b50) throw new Error("Corrupt zip entry.");
    const dataStart = offset + 30 + u16(local, 26) + u16(local, 28);
    return {
      name,
      method,
      csize,
      usize,
      data: blob.slice(dataStart, dataStart + csize),
    };
  }
  throw new Error("export.xml was not found inside this zip.");
}

// Stream the XML text out of a zip or a plain export.xml, line by line.
export async function* xmlLines(file, onProgress) {
  let stream;
  let total;
  if (/\.zip$/i.test(file.name) || file.type === "application/zip") {
    const entry = await locateEntry(file);
    total = entry.usize;
    stream =
      entry.method === 8
        ? entry.data
            .stream()
            .pipeThrough(new DecompressionStream("deflate-raw"))
        : entry.data.stream();
  } else {
    total = file.size;
    stream = file.stream();
  }
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let carry = "";
  let seen = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    seen += value.length;
    const chunk = carry + value;
    const parts = chunk.split("\n");
    carry = parts.pop();
    for (const line of parts) yield line;
    onProgress?.(Math.min(1, seen / (total || seen)));
  }
  if (carry) yield carry;
}

export async function importHealthFile(file, onProgress) {
  const scanner = createScanner();
  for await (const line of xmlLines(file, onProgress)) scanner.line(line);
  return scanner.result();
}
