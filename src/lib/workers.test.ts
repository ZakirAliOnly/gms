import assert from "node:assert/strict";
import { test } from "node:test";
import { computePayroll, monthLabel, monthOptions, parseMonth } from "./workers";

test("payroll matches the reference example: 29,260 wage, no extras", () => {
  const p = computePayroll({ monthlyWage: 29260, extra: 0, absentDays: 0, advances: 0 });
  assert.equal(p.net, 29260);
});

test("absence is deducted at wage / 30 per day, advances come off last", () => {
  const p = computePayroll({ monthlyWage: 30000, extra: 500, absentDays: 2, advances: 1000 });
  assert.equal(p.absence, 2000);
  assert.equal(p.adjustedGross, 28500);
  assert.equal(p.net, 27500);
});

test("parseMonth accepts YYYY-MM and falls back for junk", () => {
  assert.equal(parseMonth("2026-03"), "2026-03");
  assert.match(parseMonth("2026-13"), /^\d{4}-\d{2}$/);
  assert.match(parseMonth(undefined), /^\d{4}-\d{2}$/);
});

test("month labels and options", () => {
  assert.equal(monthLabel("2026-11"), "November 2026");
  const opts = monthOptions("2024-01", new Date("2026-11-03T10:00:00Z"));
  assert.equal(opts[0].value, "2026-11");
  assert.ok(opts.some((o) => o.value === "2024-01"));
  assert.equal(opts.length, 13);
});
