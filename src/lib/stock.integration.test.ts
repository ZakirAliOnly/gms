import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { recordPurchase, payPurchase } from "./purchases";
import { recordSale } from "./retail-sale";
import { readInvoice, changeInvoice } from "./invoice-management";
import { adjustInventory } from "./adjust-stock";
import { buildReports } from "./reports";
import { reportRange } from "./report-range";
import { membershipFilter } from "./membership-filter";
import { saveBranchUser } from "./branch-users";
import { canAccess } from "./module-access";
import bcrypt from "bcryptjs";
import { queryActivityLog, activityMetrics } from "./activity-log";
import { membershipReceipt } from "./membership-receipt";
import { invoiceDocument } from "@/app/app/invoices/invoice-receipt";
import { dashboardInsights } from "./dashboard-insights";
import { startOfToday, startOfDaysFromNow } from "./dates";
import { Pool } from "pg";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

test(
  "FIFO upgrade preserves existing stock and marks historical cost as unknown",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const client = await pool.connect();
    const schema = `fifo_upgrade_${randomUUID().replaceAll("-", "")}`;
    try {
      await client.query("BEGIN");
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}"`);
      const root = path.join(process.cwd(), "prisma/migrations");
      const migrations = (await readdir(root)).filter((name) => /^\d/.test(name)).sort();
      const fifo = "20261031140000_fifo_stock";
      for (const name of migrations.filter((name) => name < fifo))
        await client.query(await readFile(path.join(root, name, "migration.sql"), "utf8"));
      await client.query(`INSERT INTO "User" (id,email,"passwordHash",name,role,"updatedAt") VALUES ('owner','upgrade@test.invalid','unusable','Owner','SUPERADMIN',NOW());
      INSERT INTO "Tenant" (id,name,location,slug,"createdById","updatedAt") VALUES ('branch','Branch','Test','branch','owner',NOW());
      INSERT INTO "Product" (id,"tenantId",serial,name,"salePrice","costPrice",quantity,"updatedAt") VALUES ('product','branch',1,'Water',50,12.5,7,NOW());
      INSERT INTO "PaymentMethod" (id,"tenantId",name) VALUES ('cash','branch','Cash');
      INSERT INTO "RetailInvoice" (id,"tenantId",number,subtotal,total,"paymentMethodId") VALUES ('invoice','branch','INV-000001',50,50,'cash');
      INSERT INTO "RetailInvoiceLine" (id,"tenantId","invoiceId","productId","unitPrice",quantity,"lineTotal") VALUES ('line','branch','invoice','product',50,1,50);`);
      await client.query(await readFile(path.join(root, fifo, "migration.sql"), "utf8"));
      const lot = (await client.query('SELECT * FROM "StockLot"')).rows[0];
      assert.equal(lot.remaining, 7);
      assert.equal(lot.unitCost, "12.50");
      assert.equal(lot.source, "LegacyOpening");
      assert.equal(
        (await client.query('SELECT "costTotal" FROM "RetailInvoiceLine"')).rows[0].costTotal,
        null
      );
      assert.equal((await client.query('SELECT quantity FROM "Product"')).rows[0].quantity, 7);
      await client.query(`INSERT INTO "User" (id,email,"passwordHash",name,role,"tenantId","updatedAt") VALUES ('manager','manager@test.invalid','unusable','Manager','TENANT','branch',NOW());
        INSERT INTO "Package" (id,"tenantId",name,price,"updatedAt") VALUES ('package','branch','Monthly',100,NOW());
        INSERT INTO "Member" (id,"tenantId",name,phone,barcode,"updatedAt") VALUES ('member','branch','Member','03001234567','123',NOW());
        INSERT INTO "Membership" (id,"tenantId","memberId","packageId","nextRenewalDate","updatedAt") VALUES ('membership','branch','member','package',NOW(),NOW());
        INSERT INTO "RenewalPayment" (id,"tenantId","membershipId",amount,"paymentMethodId","recordedAt","periodStart","periodEnd") VALUES ('first','branch','membership',10,'cash','2026-01-01',NOW(),NOW()),('second','branch','membership',20,'cash','2026-02-01',NOW(),NOW());`);
      await client.query(
        await readFile(
          path.join(root, "20261031160000_branch_users_receipts", "migration.sql"),
          "utf8"
        )
      );
      const manager = (
        await client.query(
          'SELECT "isBranchManager", "sessionVersion" FROM "User" WHERE id = \'manager\''
        )
      ).rows[0];
      assert.equal(manager.isBranchManager, true);
      assert.equal(manager.sessionVersion, 0);
      assert.deepEqual(
        (await client.query('SELECT kind FROM "RenewalPayment" ORDER BY "recordedAt"')).rows.map(
          (row) => row.kind
        ),
        ["ADMISSION", "RENEWAL"]
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  }
);

const connectionString = process.env.TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  assert.ok(
    ["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname.endsWith("_test"),
    "Use a dedicated local *_test database."
  );
}
const integration = (name: string, fn: (f: Awaited<ReturnType<typeof fixture>>) => Promise<void>) =>
  test(name, { skip: !connectionString }, async () => {
    const f = await fixture();
    try {
      await fn(f);
    } finally {
      await f.cleanup();
    }
  });

async function fixture() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString! }) });
  const suffix = randomUUID();
  const actor = await db.user.create({
    data: {
      email: `${suffix}@test.invalid`,
      name: "Test",
      passwordHash: "unusable-test-hash",
      role: "SUPERADMIN",
    },
  });
  const tenant = await db.tenant.create({
    data: { name: "Test branch", slug: suffix, location: "Test", createdById: actor.id },
  });
  const other = await db.tenant.create({
    data: {
      name: "Other branch",
      slug: `${suffix}-other`,
      location: "Other",
      createdById: actor.id,
    },
  });
  const cash = await db.paymentMethod.create({
    data: { tenantId: tenant.id, name: "Cash", openingBalance: 1000 },
  });
  const supplier = await db.supplier.create({ data: { tenantId: tenant.id, name: "Supplier" } });
  const product = await db.product.create({
    data: { tenantId: tenant.id, serial: 1, name: "Water", category: "Drinks", salePrice: 50 },
  });
  const receive = (lines: { quantity: number; unitCost: number }[], amountPaid = 0) =>
    recordPurchase(db, tenant.id, actor.id, {
      supplierId: supplier.id,
      lines: lines.map((line) => ({ ...line, productId: product.id, unitSalePrice: 50 })),
      amountPaid,
      paymentMethodId: cash.id,
    });
  const sale = (quantity: number) =>
    recordSale(db, tenant.id, actor.id, {
      lines: [{ productId: product.id, quantity }],
      discount: 0,
      paymentMethodId: cash.id,
    });
  const stock = async () => {
    const p = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    const lots = await db.stockLot.findMany({
      where: { tenantId: tenant.id, productId: p.id },
      orderBy: { sequence: "asc" },
    });
    assert.equal(
      lots.reduce((sum, lot) => sum + lot.remaining, 0),
      p.quantity
    );
    const movements = await db.stockMovement.aggregate({
      where: { tenantId: tenant.id, productId: p.id },
      _sum: { quantityDelta: true },
    });
    assert.equal(movements._sum.quantityDelta ?? 0, p.quantity);
    return { quantity: p.quantity, lots };
  };
  return {
    db,
    tenant,
    other,
    actor,
    cash,
    supplier,
    product,
    receive,
    sale,
    stock,
    cleanup: async () => {
      for (const id of [tenant.id, other.id]) {
        await db.stockAllocation.deleteMany({ where: { tenantId: id } });
        await db.retailInvoice.deleteMany({ where: { tenantId: id } });
        await db.purchaseInvoice.deleteMany({ where: { tenantId: id } });
        await db.membership.deleteMany({ where: { tenantId: id } });
        await db.member.deleteMany({ where: { tenantId: id } });
        await db.product.deleteMany({ where: { tenantId: id } });
        await db.supplier.deleteMany({ where: { tenantId: id } });
        await db.paymentTransfer.deleteMany({ where: { tenantId: id } });
        await db.expense.deleteMany({ where: { tenantId: id } });
        await db.expenseCategory.deleteMany({ where: { tenantId: id } });
        await db.paymentMethod.deleteMany({ where: { tenantId: id } });
        await db.package.deleteMany({ where: { tenantId: id } });
        await db.tenant.delete({ where: { id } });
        await db.auditLog.deleteMany({ where: { tenantId: id } });
      }
      await db.user.delete({ where: { id: actor.id } });
      await db.$disconnect();
    },
  };
}

integration(
  "supplier receipt -> FIFO sale -> edit -> delete preserves costs, quantities and documents",
  async (f) => {
    const purchase = await f.receive([
      { quantity: 2, unitCost: 10 },
      { quantity: 3, unitCost: 20 },
    ]);
    assert.equal(Number(purchase.total), 80);
    assert.equal(
      await f.db.purchaseInvoiceLine.count({ where: { purchaseInvoiceId: purchase.id } }),
      2
    );
    const sold = await f.sale(3);
    const line = await f.db.retailInvoiceLine.findFirstOrThrow({
      where: { invoiceId: sold.saved.id },
    });
    assert.equal(Number(line.costTotal), 40);
    assert.deepEqual(
      (await f.stock()).lots.map((l) => l.remaining),
      [0, 2]
    );
    let current = (await readInvoice(f.db, f.tenant.id, sold.saved.id))!;
    assert.deepEqual(
      await changeInvoice(f.db, f.tenant.id, f.actor.id, current.id, current.version, {
        lines: [{ productId: f.product.id, quantity: 1 }],
        discount: 0,
        paymentMethodId: f.cash.id,
      }),
      { ok: true }
    );
    assert.deepEqual(
      (await f.stock()).lots.map((l) => l.remaining),
      [1, 3]
    );
    assert.equal(
      Number(
        (await f.db.retailInvoiceLine.findFirstOrThrow({ where: { invoiceId: current.id } }))
          .costTotal
      ),
      10
    );
    current = (await readInvoice(f.db, f.tenant.id, current.id))!;
    assert.deepEqual(
      await changeInvoice(f.db, f.tenant.id, f.actor.id, current.id, current.version, null),
      { ok: true }
    );
    assert.deepEqual(
      (await f.stock()).lots.map((l) => l.remaining),
      [2, 3]
    );
    const replacement = await f.sale(1);
    assert.notEqual(replacement.saved.number, sold.saved.number);
  }
);

integration(
  "competing sales cannot oversell the last unit or duplicate an invoice number",
  async (f) => {
    await f.receive([{ quantity: 1, unitCost: 10 }]);
    const results = await Promise.allSettled([f.sale(1), f.sale(1)]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await f.stock()).quantity, 0);
    assert.equal(await f.db.retailInvoice.count({ where: { tenantId: f.tenant.id } }), 1);
  }
);

integration("concurrent supplier payments cannot exceed the outstanding invoice", async (f) => {
  const invoice = await f.receive([{ quantity: 10, unitCost: 10 }]);
  const pay = () =>
    payPurchase(f.db, f.tenant.id, f.actor.id, {
      purchaseInvoiceId: invoice.id,
      amount: 60,
      paymentMethodId: f.cash.id,
    });
  const result = await Promise.allSettled([pay(), pay()]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  const saved = await f.db.purchaseInvoice.findUniqueOrThrow({
    where: { id: invoice.id },
    include: { payments: true },
  });
  assert.equal(saved.status, "PARTIAL");
  assert.equal(
    saved.payments.reduce((n, p) => n + Number(p.amount), 0),
    60
  );
  await payPurchase(f.db, f.tenant.id, f.actor.id, {
    purchaseInvoiceId: invoice.id,
    amount: 40,
    paymentMethodId: f.cash.id,
  });
  assert.equal(
    (await f.db.purchaseInvoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "PAID"
  );
});

integration("payments on different invoices cannot overdraw a shared payment method", async (f) => {
  await f.db.paymentMethod.update({ where: { id: f.cash.id }, data: { openingBalance: 100 } });
  const a = await f.receive([{ quantity: 10, unitCost: 10 }]);
  const b = await f.receive([{ quantity: 10, unitCost: 10 }]);
  const results = await Promise.allSettled(
    [a, b].map((invoice) =>
      payPurchase(f.db, f.tenant.id, f.actor.id, {
        purchaseInvoiceId: invoice.id,
        amount: 60,
        paymentMethodId: f.cash.id,
      })
    )
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    Number(
      (
        await f.db.purchasePayment.aggregate({
          where: { tenantId: f.tenant.id },
          _sum: { amount: true },
        })
      )._sum.amount
    ),
    60
  );
});

integration(
  "branch isolation and failed writes preserve stock and supplier balances",
  async (f) => {
    const invoice = await f.receive([{ quantity: 2, unitCost: 10 }]);
    await assert.rejects(
      recordPurchase(f.db, f.other.id, f.actor.id, {
        supplierId: f.supplier.id,
        lines: [{ productId: f.product.id, quantity: 1, unitCost: 5, unitSalePrice: 10 }],
        amountPaid: 0,
      }),
      /supplier/
    );
    await assert.rejects(
      payPurchase(f.db, f.other.id, f.actor.id, {
        purchaseInvoiceId: invoice.id,
        amount: 1,
        paymentMethodId: f.cash.id,
      }),
      /not found/
    );
    await assert.rejects(
      recordSale(f.db, f.other.id, f.actor.id, {
        lines: [{ productId: f.product.id, quantity: 1 }],
        paymentMethodId: f.cash.id,
        discount: 0,
      }),
      /payment method/
    );
    await assert.rejects(f.receive([{ quantity: 1, unitCost: 10 }], 11), /cannot exceed/);
    await assert.rejects(f.sale(3), /Not enough stock/);
    assert.equal((await f.stock()).quantity, 2);
    assert.equal(await f.db.purchaseInvoice.count({ where: { tenantId: f.tenant.id } }), 1);
  }
);

integration("manual corrections use FIFO and never make stock negative", async (f) => {
  await f.receive([
    { quantity: 2, unitCost: 10 },
    { quantity: 2, unitCost: 20 },
  ]);
  await adjustInventory(f.db, f.tenant.id, f.actor.id, f.product.id, -3, "Damaged");
  assert.deepEqual(
    (await f.stock()).lots.map((l) => l.remaining),
    [0, 1]
  );
  await assert.rejects(
    adjustInventory(f.db, f.tenant.id, f.actor.id, f.product.id, -2, "Damaged"),
    /Only 1/
  );
  await adjustInventory(f.db, f.tenant.id, f.actor.id, f.product.id, 2, "Count correction");
  assert.equal((await f.stock()).quantity, 3);
  const sale = await f.sale(2);
  assert.equal(
    Number(
      (await f.db.retailInvoiceLine.findFirstOrThrow({ where: { invoiceId: sale.saved.id } }))
        .costTotal
    ),
    40
  );
});

integration(
  "reports reconcile sales, FIFO cost, supplier payable and cash without double counting",
  async (f) => {
    await f.receive(
      [
        { quantity: 2, unitCost: 10 },
        { quantity: 3, unitCost: 20 },
      ],
      30
    );
    await f.sale(3);
    const now = new Date();
    const rows = await buildReports(f.db, f.tenant.id, reportRange(undefined, undefined, now), now);
    const insights = await dashboardInsights(f.db, f.tenant.id, now);
    assert.equal(insights.series.at(-1)?.retail, 150);
    assert.equal(
      (await dashboardInsights(f.db, f.other.id, now)).series.reduce((n, row) => n + row.retail, 0),
      0
    );
    const section = (title: string) => rows.find((r) => r.title === title)!;
    assert.deepEqual(section("Retail sales").rows[0], ["Water", "Drinks", 3, 150, 0, 150, 40, 0]);
    assert.deepEqual(section("Supplier purchases").rows[0], ["Supplier", 80, 30, 50]);
    assert.deepEqual(section("Cash by payment method").rows[0], ["Cash", 0, 150, 0, 30, 0, 0, 120]);
    assert.equal(section("Inventory").rows[0][5], 40);
    const isolated = await buildReports(f.db, f.other.id, reportRange());
    assert.equal(isolated.find((r) => r.title === "Retail sales")!.rows.length, 0);
  }
);

integration(
  "active and renewal filters age memberships by Karachi dates without scheduled status changes",
  async (f) => {
    const now = new Date();
    const pack = await f.db.package.create({
      data: { tenantId: f.tenant.id, name: "Monthly", price: 100, durationMonths: 1 },
    });
    for (const [index, days] of [-1, 0, 2, 10].entries()) {
      const member = await f.db.member.create({
        data: {
          tenantId: f.tenant.id,
          name: `Member ${index}`,
          phone: "03001234567",
          barcode: String(index),
        },
      });
      await f.db.membership.create({
        data: {
          tenantId: f.tenant.id,
          memberId: member.id,
          packageId: pack.id,
          nextRenewalDate: startOfDaysFromNow(days, now),
          status: "ACTIVE",
        },
      });
    }
    assert.equal(
      await f.db.membership.count({ where: membershipFilter("active", f.tenant.id, now) }),
      3
    );
    assert.equal(
      await f.db.membership.count({ where: membershipFilter("renewals", f.tenant.id, now) }),
      2
    );
    assert.equal(
      await f.db.membership.count({ where: membershipFilter("overdue", f.tenant.id, now) }),
      1
    );
    assert.ok(startOfToday(now).getTime() <= now.getTime());
  }
);

integration(
  "branch managers can create staff and update grants without changing protected managers",
  async (f) => {
    const manager = await f.db.user.create({
      data: {
        name: "Manager",
        email: `${randomUUID()}@test.invalid`,
        passwordHash: "unusable",
        role: "TENANT",
        tenantId: f.tenant.id,
        isBranchManager: true,
      },
    });
    const input = {
      name: "Team member",
      email: `${randomUUID()}@test.invalid`,
      password: "a-long-test-password",
      status: "ACTIVE",
      moduleAccess: ["inventory", "memberships"],
      editableModules: ["inventory"],
    };
    const saved = await saveBranchUser(f.db, f.tenant.id, manager.id, input);
    let staff = await f.db.user.findUniqueOrThrow({ where: { id: saved.id } });
    assert.equal(staff.isBranchManager, false);
    assert.equal(canAccess(staff, "memberships", "edit"), false);
    assert.equal(canAccess(staff, "inventory", "edit"), true);
    assert.ok(await bcrypt.compare(input.password, staff.passwordHash));
    await assert.rejects(
      saveBranchUser(f.db, f.other.id, manager.id, input),
      /Only the branch manager/
    );
    await assert.rejects(
      saveBranchUser(f.db, f.tenant.id, staff.id, {
        ...input,
        email: `${randomUUID()}@test.invalid`,
      }),
      /Only the branch manager/
    );
    await assert.rejects(
      saveBranchUser(f.db, f.tenant.id, manager.id, { ...input, id: manager.id }),
      /cannot be changed/
    );
    await saveBranchUser(f.db, f.tenant.id, manager.id, {
      ...input,
      id: staff.id,
      password: undefined,
      editableModules: [],
    });
    staff = await f.db.user.findUniqueOrThrow({ where: { id: staff.id } });
    assert.equal(canAccess(staff, "inventory", "edit"), false);
    assert.equal(staff.sessionVersion, 0);
    await saveBranchUser(f.db, f.tenant.id, manager.id, {
      ...input,
      id: staff.id,
      status: "DISABLED",
      password: undefined,
    });
    staff = await f.db.user.findUniqueOrThrow({ where: { id: staff.id } });
    assert.equal(staff.status, "DISABLED");
    assert.equal(staff.sessionVersion, 1);
    const logs = await f.db.auditLog.findMany({
      where: { tenantId: f.tenant.id, target: staff.id },
    });
    assert.equal(logs.length, 3);
    assert.ok(!JSON.stringify(logs).includes(input.password));
    assert.ok(!JSON.stringify(logs).includes(staff.passwordHash));
  }
);

integration(
  "Supervisor logs and metrics span branches while branch logs remain isolated",
  async (f) => {
    const supervisor = await f.db.user.create({
      data: {
        name: "Supervisor",
        email: `${randomUUID()}@test.invalid`,
        passwordHash: "unusable",
        role: "ADMIN",
      },
    });
    try {
      await f.db.auditLog.createMany({
        data: [
          {
            tenantId: f.tenant.id,
            actorId: supervisor.id,
            action: "RETAIL_INVOICE_CREATE",
            target: "invoice-a",
            meta: { total: 100, paymentMethod: "Cash" },
          },
          {
            tenantId: f.other.id,
            actorId: supervisor.id,
            action: "EXPENSE_CREATE",
            target: "expense-b",
            meta: { amount: 20 },
          },
          {
            tenantId: f.tenant.id,
            actorId: supervisor.id,
            action: "RETAIL_INVOICE_EDIT",
            target: "invoice-a",
            meta: { previousTotal: 100, total: 80 },
          },
        ],
      });
      const filters = { q: "", action: "", page: 1, range: "today" };
      const local = await queryActivityLog(f.db, { tenantId: f.tenant.id }, filters);
      assert.equal(local.total, 2);
      assert.ok(local.rows.every((row) => row.actor === "Supervisor"));
      const all = await queryActivityLog(f.db, { admin: true }, { ...filters, q: supervisor.id });
      assert.equal(all.total, 3);
      const metrics = await activityMetrics(
        f.db,
        { admin: true },
        { ...filters, q: supervisor.id }
      );
      assert.equal(metrics.cashIn, 100);
      assert.equal(metrics.cashOut, 40);
      assert.equal(metrics.invoices, 1);
    } finally {
      await f.db.user.delete({ where: { id: supervisor.id } });
    }
  }
);

integration(
  "admission and renewal reprints use the saved payment and include the thermal footer",
  async (f) => {
    const pack = await f.db.package.create({
      data: { tenantId: f.tenant.id, name: "Monthly", price: 100 },
    });
    const member = await f.db.member.create({
      data: {
        tenantId: f.tenant.id,
        name: "Thermal member",
        phone: "03001234567",
        barcode: "THERMAL",
      },
    });
    const membership = await f.db.membership.create({
      data: {
        tenantId: f.tenant.id,
        memberId: member.id,
        packageId: pack.id,
        nextRenewalDate: new Date(),
      },
    });
    for (const kind of ["ADMISSION", "RENEWAL"]) {
      const payment = await f.db.renewalPayment.create({
        data: {
          tenantId: f.tenant.id,
          membershipId: membership.id,
          amount: "125.50",
          paymentMethodId: f.cash.id,
          kind,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
      });
      const receipt = await membershipReceipt(f.db, f.tenant.id, payment.id);
      assert.equal(
        receipt.heading,
        kind === "ADMISSION" ? "Admission payment receipt" : "Renewal payment receipt"
      );
      assert.equal(receipt.total, "125.5");
      const html = invoiceDocument(receipt);
      assert.ok(html.includes("width: 80mm"));
      assert.ok(html.includes("Software Develop By: AddsMint.com"));
      await assert.rejects(membershipReceipt(f.db, f.other.id, payment.id));
    }
  }
);
