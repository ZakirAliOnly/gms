# Redesign validation

The screenshot and written redesign requirements are captured in
`DASHBOARD_DESIGN.md`. The repository did not previously contain that file.

## Implemented

- Shared `AppLayout`, sidebar, top bar, search, account controls and touch-sized
  navigation across tenant, Admin branch and platform pages.
- Brown primary theme and semantic design tokens in `src/app/global.css`, with
  shared typography, panels, headers, toolbars, tables, fields, dialogs and badges.
- Responsive dashboard with real revenue/expense history, period selection,
  current KPIs and recent members. No invented comparisons or notification counts.
- Consistent membership, inventory, invoice, supplier, expense, payment-method,
  data-viewer, report, settings and related detail screens. Existing thermal
  receipts remain separate printer layouts.
- Working local motion preference, save/error notifications, loading skeletons,
  empty states, page errors and date-filter validation.
- FIFO receipts, allocations and invoice reversals; supplier receipt/stock links;
  concurrent sale/payment protection; corrected membership filters and shortcuts;
  and reports with CSV plus Print / Save PDF.

## Checks completed

- `npm run lint`: passed across the repository.
- `npm run build`: passed, including TypeScript validation.
- 38 unit/integration tests: passed, with zero skipped, against a separate local
  PostgreSQL test database. This includes existing-data migration, FIFO costs,
  edits/deletion, concurrent sales and supplier payments, branch isolation,
  report reconciliation and scoped dashboard chart values.
- Production-mode Chromium checks across memberships, inventory, invoices,
  suppliers, expenses, payment methods, data viewer, settings and reports at
  1784px desktop and 390px mobile widths. No document-level horizontal overflow;
  visible buttons, text/search inputs and selects met the 44px target checks.
- Tablet dashboard and navigation expansion checked at 1024px. Mobile drawer
  opens, navigates and closes correctly. Mobile adjustment dialog inspected.
- Authenticated login, due/overdue navigation, focused barcode lookup including
  overdue members, add-member shortcut, FIFO receipt links, CSV download,
  invalid date feedback, persisted display preference, Admin branch reports and
  a branch-scoped stock-adjustment Server Action verified in the browser.
- Forged branch headers and tenant attempts to enter Admin branch routes were
  refused. These are targeted checks, not a full security/accessibility audit.

## Deployment notes

No VPS deployment or environment publication was performed. Run the FIFO
migration before starting the new release; see `stock-and-reports.md` for data
limitations and rollout notes. The exact custom logo/favicon replacement remains
pending an accessible source image file.

The ignored local `.env` now targets a fresh `gms_development_fifo` database with
the final migrations applied. The original local database was retained unchanged;
no reset was performed. Test fixtures used a separate `gms_workflows_test`
database, and the temporary application server was stopped after validation.
