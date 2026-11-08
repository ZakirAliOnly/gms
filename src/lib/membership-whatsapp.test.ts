import assert from "node:assert/strict";
import { test } from "node:test";
import { createMembershipSchema, updateMembershipSchema } from "./validators/membership";

const member = { name: "Ali", packageId: "package", amountPaid: 1500, paymentMethodId: "cash" };

test("the single member WhatsApp number is required on new/edit forms", () => {
  for (const schema of [createMembershipSchema, updateMembershipSchema]) {
    for (const phone of [undefined, null, "", " ", "abc", "02112345678", "0300+1234567"]) {
      const parsed = schema.safeParse({ ...member, membershipId: "membership", phone });
      assert.equal(parsed.success, false);
      if (!parsed.success)
        assert.ok(parsed.error.issues.some((issue) => issue.path[0] === "phone"));
    }
    for (const phone of ["03001234567", "+92 300 1234567", "923001234567"]) {
      const parsed = schema.parse({ ...member, membershipId: "membership", phone });
      assert.equal(parsed.phone, "+923001234567");
      assert.ok(!("whatsappNumber" in parsed));
    }
  }
});

test("editing the shared international member number retains its country code", () => {
  const parsed = updateMembershipSchema.parse({
    ...member,
    membershipId: "membership",
    phone: "+14155552671",
  });
  assert.equal(parsed.phone, "+14155552671");
});
