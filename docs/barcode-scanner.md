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
also accepts a manually typed exact Member ID. The focused display shows only:

- Renewal status and how long until renewal / how long overdue.
- Saved member photo (or a neutral placeholder), name and branch.
- Member ID, joined date, WhatsApp number, CNIC, email and package name.

Financial summaries, payment history, the separate package panel, quick payment
and print actions are omitted from this display. Scanning loads profile data
without querying payment totals/history. Existing membership receipt and report
functionality elsewhere remains available. An unknown ID never searches another
branch; cancelled/overdue memberships remain visible with their actual status.

**Full screen** opens the scanner itself using the browser Fullscreen API,
hiding the application shell. **Exit full screen** or Escape returns to the
normal layout. Unsupported/denied fullscreen requests show a useful message.
**New Scan**, beside Full screen, clears the member immediately and focuses the
scan field. Each completed lookup clears automatically after 15 seconds; an
unknown code also resets. A repeated scan of the same barcode starts a fresh
15-second window. Starting a new lookup cancels the previous timer to avoid
clearing a new result while it loads. Resetting preserves the selected branch
and fullscreen mode and does not navigate back to an old member in scan history.

The screen remains read-only. Lookup/reset/fullscreen do not create receipts,
payments, activity entries or receipt-counter changes. Theme colours live in
`global.css`; touch controls are at least 44px and profiles adapt to phone widths.

Validation: production Webpack build, ESLint and 70 unit/integration tests passed.
Chromium verified native fullscreen entry/exit, fullscreen surviving resets,
the 15-second deadline, timer restart for the same barcode, manual New Scan,
unknown-code reset, field focus, 375px layout/touch controls, Supervisor branch
preservation, and unchanged payment/activity data. No VPS deployment was made.
