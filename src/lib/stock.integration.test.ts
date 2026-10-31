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
      const fifo = migrations.pop()!;
      assert.equal(fifo, "20261031140000_fifo_stock");
      for (const name of migrations)
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
