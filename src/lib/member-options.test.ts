import assert from "node:assert/strict";
import { test } from "node:test";
import { isLockerExtra, normalizeLockerNumber, validateLockerNumbers } from "./member-options";
import { createMembershipSchema } from "./validators/membership";

test("registration requires a Morning or Evening shift", () => {
  const data = {
    name: "Ali",
    phone: "03001234567",
    packageId: "p",
    paymentMethodId: "cash",
    amountPaid: "1500",
  };
  for (const shift of [undefined, "", "NIGHT"])
    assert.equal(createMembershipSchema.safeParse({ ...data, shift }).success, false);
  for (const shift of ["MORNING", "EVENING"])
    assert.equal(createMembershipSchema.safeParse({ ...data, shift }).success, true);
});

test("locker fields require a number and normalize equivalent assignments", () => {
  assert.equal(isLockerExtra("Monthly Locker"), true);
  assert.equal(isLockerExtra("Lockers"), true);
  assert.equal(isLockerExtra("Personal training"), false);
  assert.equal(normalizeLockerNumber(" 058 "), "58");
  assert.equal(normalizeLockerNumber("a-12"), "A-12");
  const extras = [
    { id: "locker", name: "Locker" },
    { id: "training", name: "Training" },
  ];
  assert.ok(validateLockerNumbers(extras, {}).errors["lockerNumber:locker"]);
  assert.deepEqual(validateLockerNumbers(extras, { locker: " 058 ", training: "99" }), {
    numbers: { locker: "58" },
    errors: {},
  });
  assert.ok(
    validateLockerNumbers(
      [
        { id: "a", name: "Locker" },
        { id: "b", name: "VIP Locker" },
      ],
      { a: "58", b: "058" }
    ).errors["lockerNumber:b"]
  );
});
