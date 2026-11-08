# Admission and renewal thermal receipts

Both membership payment types use the shared 80 mm receipt document. Its header
shows the existing Gold's Gym logo first, followed by Gold's GYM and the branch
name. The member's existing barcode is printed as Code128 bars and readable text.
“Printed by” comes from the authenticated account, including when staff with
Memberships View access reprint a receipt. The print time uses Asia/Karachi.
The AddsMint software footer uses a slightly larger 11px semibold type size.
A visible Print action in member rows and payment history opens the saved
receipt for printing; its original receipt number is preserved.

Each branch automatically receives a unique three-letter alphabetical prefix.
Press Club Branch prefers PCB; Main Branch prefers MBR. If another branch already
uses the preferred code, allocation advances to another unused code. The prefix
is saved and survives branch renaming. Admission and renewal payments share one
branch counter: PCB0001, PCB0002, and so on. The numeric part expands after 9999.
Prefixes, counters and payment numbers are allocated in the same serializable
transaction as the payment, with retry handling for concurrent writes. A rollback
does not consume a number. Reprinting retains the saved number and shows the
current printer's name. Retail sale invoice numbering is unchanged.

Apply `20261108160000_branch_receipt_numbers` with `npx prisma migrate deploy`
before starting this release. It reserves unique prefixes for existing branches
and backfills historical membership payments in recorded-date/id order. Existing
internal payment IDs, amounts, periods and ledger relationships remain unchanged.
The saved receipt number is a separate printable identifier. A legacy/imported
payment without one receives its number on its first receipt request.

For old workspaces whose name is Gold's GYM or Golden GYM, the configured location
supplies the branch label. Other workspaces use their configured name; Branch is
appended when absent. Keep these values accurate in the branch configuration.

## Validation

Production Webpack build and ESLint passed. All 50 unit/integration tests passed,
including historical backfill, prefix collisions, parallel allocation, rollback,
branch isolation, stable reprints and escaping the added receipt fields.
Production-mode Chromium exercised the actual new-member and renewal forms,
confirmed consecutive IDs, loaded logo and Code128 bars, and checked a reprint by
a different staff user with View-only access. The generated 80 mm PDF contains
the branch, member barcode, receipt number, printing user and software footer.
The settled mobile preview has no document-level horizontal overflow. A physical
thermal printer/scanner was not available for device verification.

No VPS deployment or database migration on production was performed.

## Renewal payment safety

A payment made on 8 November covers until 8 December. Opening Renew again shows
“Already paid through 8 December” and the next unpaid period, 8 December to
8 January. Recording that advance requires an explicit checkbox confirmation.
Early renewals extend the existing paid-through date; overdue renewals restart
on the payment date without catch-up charges. The database transaction compares
the quoted due date with the live due date, rejecting stale tabs, repeated POSTs
and racing payments before allocating a receipt, payment or activity entry.
The operator can reprint the saved payment after a lost response.

Admission cash is recorded on the actual payment date, independently of the
joining/coverage date. Both payment forms require at least 0.01 and at most two
decimal places within the database amount limit. New-member validation preserves
entered details. Supervisor Workers navigation now supports branch selection and
the selected branch's real Workers page.
