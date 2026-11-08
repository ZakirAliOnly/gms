import assert from "node:assert/strict";
import { test } from "node:test";
import { renewalPeriod } from "./renewal-period";
import { paymentAmount } from "./validators/membership";

test("advance renewal preserves already-paid coverage, including a second payment today", () => {
  const now = new Date("2026-11-08T10:00:00Z");
  const first = renewalPeriod(now, now);
  assert.equal(first.end.toISOString(), "2026-12-08T10:00:00.000Z");
  const next = renewalPeriod(first.end, now);
  assert.equal(next.advance, true);
  assert.equal(next.start.toISOString(), first.end.toISOString());
  assert.equal(next.end.toISOString(), "2027-01-08T10:00:00.000Z");
  const future = renewalPeriod(new Date("2027-01-08T10:00:00Z"), now);
  assert.equal(future.end.toISOString(), "2027-02-08T10:00:00.000Z");
});

test("overdue renewals restart today and month ends clamp safely", () => {
  const now = new Date("2026-01-31T10:00:00Z");
  const period = renewalPeriod(new Date("2025-11-08T10:00:00Z"), now);
  assert.equal(period.advance, false);
  assert.equal(period.start.toISOString(), now.toISOString());
  assert.equal(period.end.toISOString(), "2026-02-28T10:00:00.000Z");
});

test("payments reject zero, sub-cent precision and database overflow", () => {
  for (const amount of [
    "",
    "0",
    "-1",
    "0.001",
    "1.234",
    "1.000001",
    "10000000000",
    "Infinity",
    "NaN",
  ])
    assert.equal(paymentAmount.safeParse(amount).success, false, amount);
  for (const amount of ["0.01", "1500", "1500.50", "9999999999.99"])
    assert.equal(paymentAmount.safeParse(amount).success, true, amount);
});
