import assert from "node:assert/strict";
import { test } from "node:test";
import {
  paymentWhatsAppDraft,
  renewalWhatsAppDraft,
  whatsappPhone,
  whatsappWebUrl,
  WHATSAPP_FOOTER,
} from "./whatsapp";

const member = { name: "Ali Ahmed", phone: "+923001234567", barcode: "IR123456" };
const payment = {
  branchName: "Press Club Branch",
  kind: "ADMISSION" as const,
  number: "PCB0001",
  member,
  packageName: "Monthly",
  amount: "1500.50",
  method: "Cash",
  preparedBy: "Zakir Ali",
  paidAt: new Date("2026-11-08T08:00:00Z"),
  periodStart: new Date("2026-11-08T08:00:00Z"),
  nextRenewal: new Date("2026-12-08T08:00:00Z"),
};

test("WhatsApp normalizes domestic and explicit international numbers and rejects ambiguous values", () => {
  for (const value of [
    "03001234567",
    "0300-1234567",
    "+92 300 1234567",
    "00923001234567",
    "923001234567",
    "3001234567",
  ])
    assert.equal(whatsappPhone(value), "923001234567");
  assert.equal(whatsappPhone("+1 (415) 555-2671"), "14155552671");
  for (const value of [
    "",
    "abc",
    "0300+1234567",
    "+92300+1234567",
    "03001234567 ext 3",
    "02112345678",
    "123",
    "+00000",
    "+1234567890123456",
  ])
    assert.equal(whatsappPhone(value), null, value);
});

test("payment WhatsApp messages contain the saved receipt, amount, period and exact footer", () => {
  const draft = paymentWhatsAppDraft(payment);
  assert.equal(
    draft.message,
    [
      "*Gold's GYM*",
      "*Press Club Branch*",
      "*New Membership Payment Receipt*",
      "",
      "Receipt No: PCB0001",
      "Date: 08-Nov-2026",
      "Member: Ali Ahmed",
      "Member Barcode: IR123456",
      "Package: Monthly",
      "Amount Paid: Rs\u00a01,500.50",
      "Payment Method: Cash",
      "Period Start: 08-Nov-2026",
      "Next Renewal: 08-Dec-2026",
      "Prepared By: Zakir Ali",
      "",
      "Thank you for your payment.",
      WHATSAPP_FOOTER,
    ].join("\n")
  );
  assert.ok(
    paymentWhatsAppDraft({ ...payment, kind: "RENEWAL" }).message.includes(
      "*Renewal Payment Receipt*"
    )
  );
  const url = new URL(whatsappWebUrl(draft)!);
  assert.equal(url.origin, "https://web.whatsapp.com");
  assert.equal(url.pathname, "/send");
  assert.equal(url.searchParams.get("phone"), "923001234567");
  assert.equal(url.searchParams.get("text"), draft.message);
  assert.equal(whatsappWebUrl({ ...draft, phone: null }), null);
  assert.equal(whatsappWebUrl({ ...draft, message: " " }), null);
});

test("renewal reminders distinguish upcoming, due today and overdue using Karachi dates", () => {
  const now = new Date("2026-11-08T20:00:00Z"); // 9 November in Karachi.
  const base = { branchName: "Press Club Branch", member, packageName: "Monthly", fee: "1750" };
  for (const [date, status] of [
    ["2026-11-08T08:00:00Z", "overdue"],
    ["2026-11-08T21:00:00Z", "due today"],
    ["2026-11-12T08:00:00Z", "upcoming"],
  ]) {
    const draft = renewalWhatsAppDraft({ ...base, renewalDate: new Date(date) }, now);
    assert.ok(draft.message.includes(`Your membership renewal is *${status}*.`));
    assert.ok(draft.message.includes("Renewal Fee:"));
    assert.ok(!draft.message.includes("Amount Paid:"));
    assert.ok(draft.message.endsWith(WHATSAPP_FOOTER));
  }
});

test("member data cannot insert extra message lines and URL encoding preserves special characters", () => {
  const draft = paymentWhatsAppDraft({
    ...payment,
    member: { ...member, name: "Ali & Sons\nReceipt No: FAKE" },
  });
  assert.ok(draft.message.includes("Member: Ali & Sons Receipt No: FAKE"));
  assert.equal(
    draft.message.split("\n").filter((line) => line.startsWith("Receipt No:")).length,
    1
  );
  assert.equal(new URL(whatsappWebUrl(draft)!).searchParams.get("text"), draft.message);
});

test("stored international WhatsApp recipients retain their country code", () => {
  const draft = paymentWhatsAppDraft({
    ...payment,
    member: { ...member, phone: "+14155552671" },
  });
  assert.equal(draft.phone, "14155552671");
  assert.equal(paymentWhatsAppDraft({ ...payment, member: { ...member, phone: "" } }).phone, null);
});

test("payment receipts and renewal reminders use the same member number with different messages", () => {
  const receipt = paymentWhatsAppDraft(payment);
  const reminder = renewalWhatsAppDraft(
    {
      branchName: payment.branchName,
      member,
      packageName: payment.packageName,
      fee: payment.amount,
      renewalDate: payment.nextRenewal,
    },
    payment.paidAt
  );
  assert.equal(receipt.phone, "923001234567");
  assert.equal(reminder.phone, receipt.phone);
  assert.notEqual(receipt.message, reminder.message);
});
