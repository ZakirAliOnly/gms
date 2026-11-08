import { GYM_NAME, SOFTWARE_FOOTER } from "@/lib/branding";
import { printText as text } from "@/lib/barcode-label";
import { formatDate, formatMoneyPrecise } from "@/lib/format";
import { scannerRenewalStatus, type ScannerRecord } from "@/lib/member-scanner";

export function scannerPrintDocument(
  record: ScannerRecord,
  printedBy: string,
  now = new Date()
): string {
  const { profile, payments } = record;
  const membership = profile.membership;
  const photo = profile.photoUrl?.startsWith("/uploads/members/")
    ? `<img class="member-photo" src="${text(profile.photoUrl)}" alt="Member photo">`
    : "";
  const date = (value: string) => text(formatDate(new Date(value)));
  const money = (value: string) => text(formatMoneyPrecise(value));
  const row = (label: string, value: string | null) =>
    `<div><dt>${text(label)}</dt><dd>${text(value || "—")}</dd></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Member report ${text(profile.barcode)}</title><style>
@page { size: A4; margin: 14mm 12mm 22mm; }
* { box-sizing: border-box; } body { margin: 0; color: black; background: white; font: 12px/1.5 Arial, sans-serif; }
.member-photo { display: block; width: 25mm; height: 25mm; object-fit: cover; margin: 0 auto 4mm; }
header { text-align: center; margin-bottom: 6mm; } header img { width: 20mm; height: 20mm; } h1 { margin: 0; font-size: 22px; } h2 { font-size: 16px; margin-top: 6mm; }
p { margin: 2mm 0; } dl { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 8mm; } dl div { display: flex; justify-content: space-between; gap: 4mm; border-bottom: 1px solid #ccc; padding: 2mm 0; } dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; } th, td { padding: 2mm; border-bottom: 1px solid #ccc; text-align: left; overflow-wrap: anywhere; } th { border-top: 1px solid black; } tr { break-inside: avoid; } thead { display: table-header-group; }
footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; border-top: 1px solid #ccc; padding-top: 3mm; font-size: 10px; }
.page-layout > tbody > tr { break-inside: auto; }
.page-layout > tbody > tr > td, .page-layout > tfoot > tr > td { padding: 0; border: 0; }
.page-layout > tfoot > tr > td { height: 12mm; }
</style></head><body><table class="page-layout"><tbody><tr><td><header><img src="/golds-gym-logo.png" alt="Gold's Gym logo"><h1>${text(GYM_NAME)}</h1><p>${text(profile.branchName)}</p><strong>Member profile and payment history</strong></header>
${photo}
<dl>${row("Member", profile.name)}${row("Member ID", profile.barcode)}${row("Joined", formatDate(new Date(profile.joinedAt)))}${row("WhatsApp number", profile.phone)}${row("CNIC", profile.cnic)}${row("Email", profile.email)}${row("Package", membership?.packageName ?? null)}${row("Status", scannerRenewalStatus(profile, now).label)}${row("Membership start", membership ? formatDate(new Date(membership.startDate)) : null)}${row("Extras", membership?.extras.map((extra) => `${extra.name} (${formatMoneyPrecise(extra.fee)})`).join(", ") || "None")}${row("Next renewal", membership ? formatDate(new Date(membership.nextRenewalDate)) : null)}${row("Current renewal fee", membership ? formatMoneyPrecise(membership.renewalFee) : null)}${row("Total membership payments", formatMoneyPrecise(record.totalPaid))}${row("Payment count", String(record.totalCount))}</dl>
<p>${text(scannerRenewalStatus(profile, now).detail)}</p><p>Current renewal fee is the package and extras fee, not a confirmed outstanding ledger balance.</p>
<h2>Complete membership payment history</h2><table><thead><tr><th>Date</th><th>Receipt / type</th><th>Covered period</th><th>Method</th><th>Amount</th></tr></thead><tbody>${payments.map((payment) => `<tr><td>${date(payment.date)}</td><td>${text(payment.number ?? "Not issued")}<br>${text(payment.kind === "ADMISSION" ? "Admission" : "Renewal")}</td><td>${date(payment.periodStart)} – ${date(payment.periodEnd)}</td><td>${text(payment.method)}</td><td>${money(payment.amount)}</td></tr>`).join("") || '<tr><td colspan="5">No payments recorded.</td></tr>'}</tbody></table>
<p>Printed by: ${text(printedBy)} · ${text(now.toLocaleString("en-PK", { timeZone: "Asia/Karachi" }))}</p></td></tr></tbody><tfoot><tr><td></td></tr></tfoot></table><footer>${text(SOFTWARE_FOOTER)}</footer></body></html>`;
}
