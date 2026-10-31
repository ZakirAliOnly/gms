# Branch access, activity and receipts

Apply `20261031160000_branch_users_receipts` using `npx prisma migrate deploy`
before starting this release. This additive migration preserves existing tenant
accounts as branch managers. Existing `ADMIN` accounts are labelled Supervisor
and retain access to all branches; staff accounts use the `TENANT` role with
`isBranchManager=false`.

Branch managers can create and update staff in their own branch, grant separate
View and Edit permissions, reset passwords and disable accounts. They cannot
change manager accounts, their own account, another branch's users or platform
roles. Edit requires View. Permission changes apply to existing sessions;
disabling an account or resetting its password invalidates existing sessions.
Dashboard, Reports and Data Viewer grants include the cross-module information
shown by those modules. Enforce permissions on server reads/actions as well as
navigation and controls.

Activity logs include date presets, type/search filters, summary cards and
pagination. Supervisors can select any branch; branch users only see their own
branch. Cash totals describe recorded audit events, including reversals, and
exclude transfers; they are not a replacement for reconciled financial reports.
Older audit records can lack amounts or payment method names.

Admission and renewal payments have separate 80mm receipt headings and can be
reprinted from member payment history with Memberships View access. Legacy
payment kinds are backfilled by treating the earliest recorded payment per
membership as admission. For imported histories without their original admission
payment, review that classification before relying on the heading.

Printed reports, invoice/payment receipts, barcode output and CSV exports include
`Software Develop By: AddsMint.com`. CSV exports add a footer row after the data;
external importers must account for that trailer. Physical thermal printer output
requires validation on the target device.

## Validation

- Production build (`npm run build -- --webpack`) and ESLint passed. The
  environment blocked Turbopack's child-process port binding; Webpack provided
  the production build used for browser validation.
- All 44 unit/integration tests passed against the separate test database,
  including branch isolation, staff administration and receipt snapshots.
- Production-mode Chromium checks passed: manager-created staff, separate
  View/Edit controls, replayed mutation denied for a read-only session, live
  grants/revocation, disabled-session rejection, all-branch Supervisor filtering,
  branch-isolated logs, both 80mm receipt PDFs, CSV credit and credit on every
  report PDF page. Mobile user management/dialogs had no document overflow.
- The shared application credit is fixed above the viewport bottom with content
  space reserved. Browser checks confirmed its position at the dashboard top,
  after scrolling, and at a 390px mobile viewport width.

These changes have not been deployed to the VPS or published as an environment.
