# Member labels and barcode scanner

The shared membership barcode dialog now previews, downloads and prints one
2 × 1 inch label (50.8 × 25.4 mm). It contains Gold's GYM, the member name, Code128
bars, a bold readable Member ID and the software credit. The same SVG design is
used for print and the losslessly compressed 600 dpi PDF. Ten-module quiet zones
are preserved; IDs too dense for a 0.25 mm module on this label are rejected
rather than printing an unreadable code. Select 2 × 1 inch label stock, 100% /
Actual size, zero margins and no browser headers/footers on the target printer.

Open **Barcode Scanner** in the sidebar, or **Scan barcode** on the dashboard.
The page is `/app/memberships/scanner`; Supervisor branch workspaces use
`/admin/branches/{branchId}/memberships/scanner`. The Supervisor's global scanner
page asks which branch to open, avoiding ambiguous barcode matches across gyms.
Scanner access inherits Memberships View permission. No Edit grant is required.

A keyboard/USB scanner should send the Member ID followed by Enter. The field
also accepts a manually typed exact Member ID. It autofocuses/selects the value
for the next scan. Profile/photo, joining and membership dates, contact, package,
extras, renewal status and payment history are displayed read-only. Cancelled,
expired and overdue memberships can still be looked up. An unknown ID never
searches another branch. The page has no member-edit, renewal or payment actions.

On-screen history uses pages of 20 payments. The bottom **Print member report**
button fetches the complete history in a consistent read transaction and prints
an A4 member report, including the bio, photo when present, all payments, current
renewal status, printing user and repeated software footer. Each page reserves
footer space. Focus returns to the scan field after the print dialog closes.
Renewal status describes dates/status; the current package/extras fee is not
presented as a confirmed unpaid ledger balance. Scanning and printing do not
create receipts, payments, audit entries or counter updates.

## Validation

Production Webpack build, ESLint and all 63 unit/integration tests passed.
Production Chromium checks verified the actual PDF MediaBox is 144 × 72 points
(one page), printable 2 × 1 inch CSS, visible ID/bars, and the complete scanner
flow. Checks included Enter/focus, paging, loaded private member photo, complete
multi-page report with software footer on every page, focus after printing,
View-only staff access, denied module access, forged cross-branch print refusal,
Supervisor branch selection, mobile overflow/touch targets and unchanged payment,
audit and receipt-counter state. Browser print calls were intercepted; physical
printer/scanner hardware was not available. No VPS deployment was performed.

## Profile Scanner layout

The scanner follows the supplied dashboard reference: a prominent scan field,
three summary cards, a large photo/profile panel, a membership package panel,
a contextual renewal notice, and a separate payment history table. Photos use
the saved member image; missing photos show a neutral placeholder. Desktop uses
side-by-side profile/package panels, tablet stacks these panels, and phones
stack the summary cards and profile fields. The shared Gold's GYM shell and
brown theme remain consistent with other modules.

Quick actions includes **Print Profile**, with the existing full-history A4
print action also retained at the bottom. Both use the same branch-scoped,
read-only report. No renewal or payment mutation is introduced. The renewal
notice reflects actual status: 29 days remaining is a normal renewal schedule,
not a due-soon warning. Payment totals and package/extras fees remain distinct.

Verified with production build, lint, 70 existing tests and Chromium checks at
1680px, 820px and 375px: keyboard scan/focus, payment pagination, full-history
printing, 44px controls, real overdue states, no-match feedback, no page overflow,
and no payment/activity writes during lookup or printing.
