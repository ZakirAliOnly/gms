import assert from "node:assert/strict";
import { test } from "node:test";
import { scannerRenewalStatus, type ScannerRecord } from "./member-scanner";
const base: ScannerRecord["profile"] = {
  id: "member",
  name: "Ali",
  barcode: "IR123456",
  phone: "+923001234567",
  email: null,
  cnic: null,
  photoUrl: null,
  joinedAt: "2026-11-01T08:00:00Z",
  branchName: "Press Club Branch",
  membership: {
    status: "ACTIVE",
    startDate: "2026-11-01T08:00:00Z",
    nextRenewalDate: "2026-11-10T08:00:00Z",
    packageName: "Monthly",
    renewalFee: "1500",
    extras: [],
  },
};
test("scanner renewal status uses Karachi dates and does not treat cancellation as an amount due", () => {
  const now = new Date("2026-11-08T20:00:00Z"); // 9 November locally.
  assert.equal(scannerRenewalStatus(base, now).label, "Upcoming renewal");
  assert.equal(
    scannerRenewalStatus(
      { ...base, membership: { ...base.membership!, nextRenewalDate: "2026-11-08T21:00:00Z" } },
      now
    ).label,
    "Due today"
  );
  assert.equal(
    scannerRenewalStatus(
      { ...base, membership: { ...base.membership!, nextRenewalDate: "2026-11-08T08:00:00Z" } },
      now
    ).label,
    "Overdue"
  );
  assert.equal(
    scannerRenewalStatus({ ...base, membership: { ...base.membership!, status: "CANCELLED" } }, now)
      .pending,
    false
  );
  assert.equal(scannerRenewalStatus({ ...base, membership: null }, now).label, "No membership");
});
