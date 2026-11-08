import assert from "node:assert/strict";
import { test } from "node:test";
import { branchReceiptPrefix, receiptBranchName } from "./branch-receipt";
import { receiptBarcodeBars } from "./receipt-barcode";

test("branch names and distinct three-letter prefixes handle legacy branding and collisions", () => {
  assert.equal(receiptBranchName("Gold's GYM", "Press Club"), "Press Club Branch");
  assert.equal(receiptBranchName("Main Branch", "Quetta"), "Main Branch");
  assert.equal(branchReceiptPrefix("Press Club Branch", []), "PCB");
  assert.equal(branchReceiptPrefix("Main Branch", []), "MBR");
  assert.equal(branchReceiptPrefix("Press Club Branch", ["PCB"]), "PCC");
  assert.equal(branchReceiptPrefix("ZZZ", ["ZZZ"]), "AAA");
  const allocated = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const code = branchReceiptPrefix("Press Club Branch", allocated);
    assert.match(code, /^[A-Z]{3}$/);
    assert.ok(!allocated.has(code));
    allocated.add(code);
  }
});

test("receipt barcodes encode Code128 without requiring a browser DOM", () => {
  const bars = receiptBarcodeBars("IR123456");
  assert.match(bars, /^[01]+$/);
  assert.ok(bars.length > 80);
  assert.notEqual(bars, receiptBarcodeBars("IR123457"));
  assert.equal(receiptBarcodeBars(""), "");
  assert.equal(receiptBarcodeBars("اردو"), "");
});
