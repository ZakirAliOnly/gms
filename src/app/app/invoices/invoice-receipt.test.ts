import assert from "node:assert/strict";
import { test } from "node:test";
import { invoiceDocument, type InvoiceReceipt } from "./invoice-receipt";

const invoice: InvoiceReceipt = {
  number: "INV-000123",
  soldAt: "2026-09-29T12:00:00Z",
  businessName: "Demo Gym",
  location: "Lahore",
  customer: "Walk-in customer",
  paymentMethod: "Cash",
  subtotal: "500.50",
  discount: "50.00",
  total: "450.50",
  lines: [{ name: "Protein bar", quantity: 2, unitPrice: "250.25", total: "500.50" }],
};

test("receipt contains the saved invoice details and exact money amounts", () => {
  const document = invoiceDocument(invoice);
  for (const text of [
    "INV-000123",
    "Demo Gym",
    "Lahore",
    "Walk-in customer",
    "Cash",
    "Protein bar",
    "250.25",
    "500.50",
    "50.00",
    "450.50",
  ]) {
    assert.ok(document.includes(text), `Missing ${text}`);
  }
  assert.match(document, /class="quantity">2 ×/);
  assert.match(document, /@media print/);
});

test("receipt escapes user-provided text before placing it into the print document", () => {
  const document = invoiceDocument({
    ...invoice,
    businessName: '<script>alert("unsafe")</script>',
    customer: "A & B",
    lines: [{ ...invoice.lines[0], name: '<img src=x onerror="alert(1)">' }],
  });
  assert.doesNotMatch(document, /<script>|<img/);
  assert.match(document, /&lt;script&gt;/);
  assert.match(document, /A &amp; B/);
  assert.match(document, /&quot;/);
});

test("branded receipt escapes branch, barcode and printer names without allowing markup", () => {
  const document = invoiceDocument({
    ...invoice,
    branded: true,
    branchName: '<iframe src="unsafe">',
    memberBarcode: 'IR123" onerror="alert(1)',
    printedBy: '<script>alert("printer")</script>',
  });
  assert.equal((document.match(/<img /g) ?? []).length, 1);
  assert.doesNotMatch(document, /<script>|<iframe| onerror="/);
  assert.match(document, /&lt;iframe/);
  assert.match(document, /&lt;script&gt;/);
  assert.match(document, /Printed by:/);
});
