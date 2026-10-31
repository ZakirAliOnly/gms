# Stock, supplier receipts, and FIFO

Supplier purchases represent **stock received**, not draft purchase orders.
Posting a receipt creates its invoice and lines, increases stock, creates FIFO
lots at each line's cost, and optionally records an initial payment atomically.
Later supplier payments affect the payable and payment-method balance only;
they never receive the stock a second time. Separate purchase-order approval,
partial-delivery, and goods-receipt workflows are not implemented.

Sales consume the oldest received lots first, with an insertion sequence to
break timestamp ties. Each sale line stores its allocated FIFO cost. Changing
the catalogue's latest cost does not revalue previous receipts or sales.
Invoice reductions restore the most recently allocated units to their original
lots; increases consume the next available FIFO units. Deleting an invoice
restores its allocations. Quantity changes, stock movements, costs, financial
entries and audit records commit together. Serializable transactions retry
conflicting sales, receipts and supplier payments after rereading balances.

Inventory product names open the FIFO lot and movement history. Supplier
receipt links connect lots to the received products, costs and payment history.
The catalogue's **Last cost** is distinct from FIFO stock value.

## Existing data

Migration `20261031140000_fifo_stock` creates an opening lot for each existing
positive on-hand quantity at the product's last recorded cost, labelled
`LegacyOpening`. Historical receipt costs cannot be reliably reconstructed from
the previous schema. Existing sales retain a null cost rather than invented
profit. Restocking a pre-FIFO invoice uses a labelled `LegacyReturn` estimate.
Manual positive corrections use the current recorded cost. Reports explicitly
identify the limitations of these estimates. Invalid existing negative stock
must be reconciled before the migration can add its nonnegative-stock constraint.

## Reports and dashboard

The dashboard and membership list share the same Karachi-date membership
filters. Due and overdue cards open their matching lists. Barcode search focuses
the search box and includes overdue members. It supports scanners that type as
a keyboard; camera scanning is not included.

Admin branch workspaces use real routes sharing the tenant module components.
This avoids a same-server rewrite re-entering Proxy under a different origin
and stripping verified branch scope. Proxy derives scope from each URL and
removes caller-supplied scope headers, including on Server Action requests.

Reports include memberships, product/category sales, current stock and FIFO
value, stock movements, supplier purchases and payables, expense categories,
and cash movement by payment method. Date ranges are inclusive Karachi dates,
limited to 366 days. Current member/stock figures are labelled separately from
period activity. Supplier payables cover invoices in the period and payments
through its end. Supplier cash payments are counted once, outside operating
expenses. CSV and the browser's Print / Save PDF are available.

## Deployment and validation

Back up the production database and retain the currently deployed release.
Install locked dependencies with `npm ci`. Build with `npm run build`, then
apply `npx prisma migrate deploy --config prisma7.config.ts` before starting the
new release. Restart the existing PM2 application only after these steps pass.
No production deployment is performed by these changes. Rollback to code that
does not maintain FIFO lots requires reconciling any stock it changes before
returning to FIFO code; do not blindly roll back the schema or erase lot data.

Run the unit and integration tests against a separately migrated local database:

```sh
TEST_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/gms_workflows_test \
  node --import tsx --test --test-isolation=none \
  src/lib/*.test.ts src/app/app/invoices/*.test.ts
```

Integration tests require a loopback database whose name ends in `_test`.
Without `TEST_DATABASE_URL`, those tests are explicitly skipped. They cover
FIFO across different receipt costs, invoice edits/deletion, overselling,
concurrent supplier payments, manual corrections, branch isolation, report
reconciliation, date-based membership counts, and upgrading existing data.
