import assert from "node:assert/strict";
import { test } from "node:test";
import { BARCODE_LABEL_MM, barcodeLabelSvg, barcodeLabelDocument } from "./barcode-label";

test("member label has an exact 2 x 1 inch page, Code128 bars and a readable Member ID", () => {
  assert.deepEqual(BARCODE_LABEL_MM, { width: 50.8, height: 25.4 });
  const html = barcodeLabelDocument({ title: "Ali Ahmed", barcode: "IR123456" });
  for (const expected of [
    "size: 2in 1in",
    "margin: 0",
    'width="50.8mm" height="25.4mm"',
    "Member ID: IR123456",
    "Gold&#39;s GYM",
    "Ali Ahmed",
    "Software Develop By: AddsMint.com",
  ])
    assert.ok(html.includes(expected), expected);
  assert.ok((html.match(/<rect x=/g) ?? []).length > 20);
  assert.ok(html.includes('y="76"'));
});

test("label text is escaped and invalid or overly dense codes cannot produce unreadable labels", () => {
  const svg = barcodeLabelSvg({ title: '<script>alert("x")</script>', barcode: "IR123456" });
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(!svg.includes("<script>"));
  assert.throws(() => barcodeLabelSvg({ title: "Member", barcode: "" }), /cannot be encoded/);
  assert.throws(
    () => barcodeLabelSvg({ title: "Member", barcode: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" }),
    /too long/
  );
});
