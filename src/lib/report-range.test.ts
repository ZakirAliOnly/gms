import assert from "node:assert/strict";
import { test } from "node:test";
import { reportRange, csvCell } from "./report-range";

test("report dates include the full last Karachi day and reject invalid ranges", () => {
  const range = reportRange("2026-10-01", "2026-10-31");
  assert.equal(range.gte.toISOString(), "2026-09-30T19:00:00.000Z");
  assert.equal(range.lt.toISOString(), "2026-10-31T19:00:00.000Z");
  assert.throws(() => reportRange("2026-02-30", "2026-03-01"), /valid/);
  assert.throws(() => reportRange("2026-10-31", "2026-10-01"), /end date/);
  assert.throws(() => reportRange("2024-01-01", "2026-01-01"), /366/);
});
test("CSV quotes values and prevents formula evaluation in supplied names", () => {
  assert.equal(csvCell('A,"B"'), '"A,""B"""');
  assert.equal(csvCell("=SUM(A1)"), '"\'=SUM(A1)"');
  assert.equal(csvCell(-5), '"-5"');
});
