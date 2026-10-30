// Usage: node scripts/attendance/summarize-timings.cjs backend.log [session UUID or -] [outcome]
const fs = require("node:fs");

function parseLine(line) {
  const clean = line.replace(/\x1b\[[0-9;]*m/g, "");
  const start = clean.indexOf('{"event":"attendance.');
  if (start < 0) return null;
  try { return JSON.parse(clean.slice(start, clean.lastIndexOf("}") + 1)); }
  catch { return null; }
}

function summarize(records) {
  const percentile = (values, p) => values.sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
  return Object.fromEntries(["attendance.server_timing", "attendance.client_timing"].map((event) => {
    const rows = records.filter((row) => row.event === event);
    const fields = event.includes("server")
      ? ["sessionMs", "rosterMs", "faceServiceMs", "persistenceMs", "totalMs"]
      : ["captureMs", "recognitionHttpMs", "uiCommitMs", "totalMs"];
    const timings = Object.fromEntries(fields.map((field) => {
      const values = rows.map((row) => row[field]).filter((value) => Number.isFinite(value) && value >= 0);
      return [field, values.length ? { n: values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95) } : null];
    }));
    const outcomes = {};
    for (const row of rows) outcomes[row.outcome] = (outcomes[row.outcome] || 0) + 1;
    return [event, { samples: rows.length, outcomes, timings,
      ...(event.includes("server") ? {
        captureReused: rows.filter((row) => row.captureReused === true).length,
        newAttendance: rows.filter((row) => row.newAttendance === true).length,
      } : {}),
    }];
  }));
}

if (require.main === module) {
  if (!process.argv[2]) throw new Error("Usage: node scripts/attendance/summarize-timings.cjs backend.log [session UUID or -] [outcome]");
  const buffer = fs.readFileSync(process.argv[2]);
  const encoding = buffer[0] === 0xff && buffer[1] === 0xfe ? "utf16le" : "utf8";
  const records = buffer.toString(encoding).split(/\r?\n/).map(parseLine)
    .filter((row) => row && (!process.argv[3] || process.argv[3] === "-" || row.sessionId === process.argv[3])
      && (!process.argv[4] || row.outcome === process.argv[4]));
  process.stdout.write(JSON.stringify(summarize(records), null, 2) + "\n");
}

module.exports = { parseLine, summarize };
