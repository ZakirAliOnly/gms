import { GYM_NAME } from "./branding";
import { formatDate, formatMoneyPrecise } from "./format";
import { startOfToday } from "./dates";

export const WHATSAPP_FOOTER = "Software By: AddsMint.com";
export type WhatsAppDraft = { recipient: string; phone: string | null; message: string };
const line = (value: string) => value.replace(/[\r\n\u0000-\u001f]+/g, " ").trim();

/** Pakistan domestic numbers default to +92; explicit international numbers stay international. */
export function whatsappPhone(value: string): string | null {
  const phone = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(phone)) return null;
  let digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) {
    if (!/^\+[^+]+$/.test(phone)) return null;
  } else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (/^03\d{9}$/.test(digits)) digits = `92${digits.slice(1)}`;
  else if (/^3\d{9}$/.test(digits)) digits = `92${digits}`;
  else if (!/^92\d{10}$/.test(digits)) return null;
  return /^[1-9]\d{6,14}$/.test(digits) ? digits : null;
}

export function whatsappWebUrl(draft: WhatsAppDraft): string | null {
  if (!draft.phone || !/^[1-9]\d{6,14}$/.test(draft.phone) || !draft.message.trim()) return null;
  return `https://web.whatsapp.com/send?${new URLSearchParams({ phone: draft.phone, text: draft.message })}`;
}

type Member = { name: string; phone: string; barcode: string };

export function paymentWhatsAppDraft(input: {
  branchName: string;
  kind: "ADMISSION" | "RENEWAL";
  number: string;
  member: Member;
  packageName: string;
  amount: string;
  method: string;
  paidAt: Date;
  periodStart: Date;
  nextRenewal: Date;
  preparedBy: string;
}): WhatsAppDraft {
  return {
    recipient: input.member.name,
    phone: whatsappPhone(input.member.phone),
    message: [
      `*${GYM_NAME}*`,
      `*${line(input.branchName)}*`,
      `*${input.kind === "ADMISSION" ? "New Membership" : "Renewal"} Payment Receipt*`,
      "",
      `Receipt No: ${line(input.number)}`,
      `Date: ${formatDate(input.paidAt)}`,
      `Member: ${line(input.member.name)}`,
      `Member Barcode: ${line(input.member.barcode)}`,
      `Package: ${line(input.packageName)}`,
      `Amount Paid: ${formatMoneyPrecise(input.amount)}`,
      `Payment Method: ${line(input.method)}`,
      `Period Start: ${formatDate(input.periodStart)}`,
      `Next Renewal: ${formatDate(input.nextRenewal)}`,
      `Prepared By: ${line(input.preparedBy)}`,
      "",
      "Thank you for your payment.",
      WHATSAPP_FOOTER,
    ].join("\n"),
  };
}

export function renewalWhatsAppDraft(
  input: {
    branchName: string;
    member: Member;
    packageName: string;
    fee: string;
    renewalDate: Date;
  },
  now = new Date()
): WhatsAppDraft {
  const days = Math.round(
    (startOfToday(input.renewalDate).getTime() - startOfToday(now).getTime()) / 86400000
  );
  const status = days < 0 ? "overdue" : days === 0 ? "due today" : "upcoming";
  return {
    recipient: input.member.name,
    phone: whatsappPhone(input.member.phone),
    message: [
      `*${GYM_NAME}*`,
      `*${line(input.branchName)}*`,
      "*Membership Renewal Reminder*",
      "",
      `Dear ${line(input.member.name)},`,
      `Your membership renewal is *${status}*.`,
      "",
      `Member Barcode: ${line(input.member.barcode)}`,
      `Package: ${line(input.packageName)}`,
      `Renewal Date: ${formatDate(input.renewalDate)}`,
      `Renewal Fee: ${formatMoneyPrecise(input.fee)}`,
      "",
      "Please renew your membership at the branch.",
      "If you have already paid, please contact reception so we can check your record.",
      "",
      WHATSAPP_FOOTER,
    ].join("\n"),
  };
}
