import assert from "node:assert/strict";
import { test } from "node:test";
import { canAccess, firstAccessiblePath, moduleFromPath } from "./module-access";
import { branchUserSchema } from "./branch-users";
const staff = {
  role: "TENANT",
  isBranchManager: false,
  moduleAccess: ["inventory", "memberships"],
  editableModules: ["inventory"],
};
test("View and Edit are separate, and Edit requires an explicit View grant", () => {
  assert.equal(canAccess(staff, "memberships"), true);
  assert.equal(canAccess(staff, "memberships", "edit"), false);
  assert.equal(canAccess(staff, "inventory", "edit"), true);
  assert.equal(canAccess(staff, "reports"), false);
  assert.equal(canAccess(staff, "users", "edit"), false);
  assert.equal(canAccess({ ...staff, moduleAccess: [] }, "inventory", "edit"), false);
  assert.equal(firstAccessiblePath(staff), "/app/memberships");
  assert.equal(canAccess({ ...staff, isBranchManager: true }, "users", "edit"), true);
  assert.equal(canAccess({ ...staff, role: "ADMIN" }, "reports", "edit"), true);
});
test("branch paths and nested exports map to the original module", () => {
  assert.equal(moduleFromPath("/admin/branches/branch1/reports/export"), "reports");
  assert.equal(moduleFromPath("/app/inventory/product1"), "inventory");
  assert.equal(moduleFromPath("/app/users"), "users");
  assert.equal(moduleFromPath("/app"), "dashboard");
});
test("user validation rejects invalid grants and never accepts a manager/role escalation", () => {
  const input = {
    name: "Staff",
    email: "staff@example.com",
    password: "a-long-test-password",
    status: "ACTIVE",
    moduleAccess: ["inventory"],
    editableModules: ["inventory"],
    role: "ADMIN",
    isBranchManager: true,
  };
  const parsed = branchUserSchema.parse(input);
  assert.equal("role" in parsed, false);
  assert.equal("isBranchManager" in parsed, false);
  assert.equal(branchUserSchema.safeParse({ ...input, moduleAccess: [] }).success, false);
  assert.equal(
    branchUserSchema.safeParse({ ...input, editableModules: ["expenses"] }).success,
    false
  );
  assert.equal(branchUserSchema.safeParse({ ...input, moduleAccess: ["users"] }).success, false);
  assert.equal(branchUserSchema.safeParse({ ...input, password: "short" }).success, false);
});
