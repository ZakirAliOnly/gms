import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@/generated/prisma/client";
import { changeInvoice, planInvoiceChange, readInvoice } from "./invoice-management";

const original = [{ productId: "p1", quantity: 2, unitPrice: "10.25" }];
const products = [
  { id: "p1", name: "Bar", quantity: 3, isActive: true, salePrice: "15.00" },
  { id: "p2", name: "Water", quantity: 10, isActive: true, salePrice: "5.10" },
];
const input = { lines: [{ productId: "p1", quantity: 3 }], discount: 0, paymentMethodId: "cash" };

test("editing retains saved prices and deducts only additional stock", () => {
  const result = planInvoiceChange(original, products, input);
  assert.equal(result.total, 30.75);
  assert.deepEqual(result.movements, [{ productId: "p1", delta: -1 }]);
});
test("removed items restore stock and new items use current prices", () => {
  const result = planInvoiceChange(original, products, {
    ...input,
    lines: [{ productId: "p2", quantity: 2 }],
    discount: 0.1,
  });
  assert.deepEqual(result.movements, [
    { productId: "p1", delta: 2 },
    { productId: "p2", delta: -2 },
  ]);
  assert.equal(result.total, 10.1);
});
test("deletion restores all invoiced stock", () => {
  const result = planInvoiceChange(original, products, null);
  assert.deepEqual(result.movements, [{ productId: "p1", delta: 2 }]);
  assert.equal(result.total, 0);
});
test("duplicate product entries cannot bypass stock validation", () => {
  assert.throws(
    () =>
      planInvoiceChange(original, products, {
        ...input,
        lines: [
          { productId: "p1", quantity: 3 },
          { productId: "p1", quantity: 3 },
        ],
      }),
    /Not enough stock/
  );
});
test("reject unavailable products, increased archived quantities, and excessive discounts", () => {
  assert.throws(() => planInvoiceChange(original, [], input), /unavailable/);
  assert.throws(
    () => planInvoiceChange(original, [{ ...products[0], isActive: false }], input),
    /archived/
  );
  assert.throws(
    () => planInvoiceChange(original, products, { ...input, discount: 100 }),
    /Discount/
  );
});

function database() {
  let state = {
    invoice: {
      id: "invoice1",
      tenantId: "tenant1",
      number: "INV-000001",
      soldAt: new Date("2026-09-30T10:00:00Z"),
      memberId: null as string | null,
      paymentMethodId: "cash",
      subtotal: "20.50",
      discount: "0",
      total: "20.50",
      tenant: { name: "Gym", location: "Lahore" },
      member: null,
      paymentMethod: { name: "Cash" },
      lines: [
        {
          id: "line1",
          productId: "p1",
          quantity: 2,
          unitPrice: "10.25",
          lineTotal: "20.50",
          product: {
            name: "Bar",
          },
        },
      ],
    },
    deleted: false,
    lots: [{ id: "lot1", remaining: 3, unitCost: "4.00" }],
    allocations: [] as { id: string; lotId: string; quantity: number }[],
    stock: 3,
    expense: 0,
    movements: [] as { quantityDelta: number }[],
    audits: [] as { action: string; meta: { number: string } }[],
  };
  let failAudit = false;
  const emptyAggregate = async () => ({ _sum: { amount: "0", total: "0" } });
  const tx = {
    stockLot: {
      findMany: async () => state.lots.filter((lot) => lot.remaining > 0),
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { remaining: { increment?: number; decrement?: number } };
      }) => {
        const lot = state.lots.find((lot) => lot.id === where.id)!;
        lot.remaining += (data.remaining.increment ?? 0) - (data.remaining.decrement ?? 0);
      },
      create: async ({ data }: { data: { remaining: number; unitCost: string } }) => {
        state.lots.push({ id: `lot${state.lots.length + 1}`, ...data });
      },
    },
    stockAllocation: {
      findMany: async () =>
        state.allocations.map((row) => ({
          ...row,
          lot: state.lots.find((lot) => lot.id === row.lotId)!,
        })),
      create: async ({ data }: { data: { lotId: string; quantity: number } }) => {
        state.allocations.push({ id: `a${state.allocations.length}`, ...data });
      },
      delete: async ({ where }: { where: { id: string } }) => {
        state.allocations = state.allocations.filter((row) => row.id !== where.id);
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { quantity: { decrement: number } };
      }) => {
        state.allocations.find((row) => row.id === where.id)!.quantity -= data.quantity.decrement;
      },
    },
    retailInvoice: {
      findFirst: async ({ where }: { where: { id: string; tenantId: string } }) =>
        !state.deleted && where.id === state.invoice.id && where.tenantId === state.invoice.tenantId
          ? structuredClone(state.invoice)
          : null,
      aggregate: async () => ({ _sum: { total: state.deleted ? "0" : state.invoice.total } }),
      update: async ({
        data,
      }: {
        data: {
          memberId: string | null;
          paymentMethodId: string;
          subtotal: number;
          discount: number;
          total: number;
          lines: {
            create: { productId: string; quantity: number; unitPrice: number; lineTotal: number }[];
          };
        };
      }) => {
        Object.assign(state.invoice, {
          ...data,
          subtotal: String(data.subtotal),
          discount: String(data.discount),
          total: String(data.total),
          lines: data.lines.create.map((line, index) => ({
            ...line,
            id: `new-${index}`,
            unitPrice: String(line.unitPrice),
            lineTotal: String(line.lineTotal),
            product: { name: "Bar" },
          })),
        });
      },
      delete: async () => {
        state.deleted = true;
      },
    },
    retailInvoiceLine: {
      deleteMany: async () => {
        state.invoice.lines = [];
      },
    },
    product: {
      findFirstOrThrow: async () => ({ costPrice: "4.00" }),
      findMany: async ({ where }: { where: { tenantId: string } }) => {
        assert.equal(where.tenantId, "tenant1");
        return [{ ...products[0], quantity: state.stock }];
      },
      update: async ({ data }: { data: { quantity: { increment: number } } }) => {
        state.stock += data.quantity.increment;
      },
    },
    paymentMethod: {
      findFirst: async ({ where }: { where: { id: string; tenantId: string } }) =>
        where.tenantId === "tenant1" && where.id === "cash"
          ? { id: "cash", name: "Cash", isActive: true, openingBalance: "0" }
          : null,
    },
    member: { findFirst: async () => null },
    renewalPayment: { aggregate: emptyAggregate },
    purchasePayment: { aggregate: emptyAggregate },
    paymentTransfer: { aggregate: emptyAggregate },
    expense: { aggregate: async () => ({ _sum: { amount: String(state.expense) } }) },
    stockMovement: {
      create: async ({ data }: { data: { quantityDelta: number } }) => {
        state.movements.push(data);
      },
    },
    auditLog: {
      create: async ({ data }: { data: { action: string; meta: { number: string } } }) => {
        if (failAudit) throw new Error("Storage failed");
        state.audits.push(data);
      },
    },
  };
  const db = {
    ...tx,
    $transaction: async (
      work: (client: typeof tx) => Promise<unknown>,
      options: { isolationLevel: string }
    ) => {
      assert.equal(options.isolationLevel, "Serializable");
      const before = structuredClone(state);
      try {
        return await work(tx);
      } catch (error) {
        state = before;
        throw error;
      }
    },
  } as unknown as PrismaClient;
  return {
    db,
    state: () => state,
    failAudit: () => {
      failAudit = true;
    },
  };
}

test("saved edits update totals, stock, and audit together", async () => {
  const fixture = database();
  const current = (await readInvoice(fixture.db, "tenant1", "invoice1"))!;
  assert.deepEqual(
    await changeInvoice(fixture.db, "tenant1", "user1", current.id, current.version, input),
    { ok: true }
  );
  assert.equal(fixture.state().stock, 2);
  assert.equal(fixture.state().invoice.total, "30.75");
  assert.equal(fixture.state().invoice.number, current.number);
  assert.equal(fixture.state().audits[0].action, "RETAIL_INVOICE_EDIT");
});
test("deletion restores stock and retains the invoice number in its audit record", async () => {
  const fixture = database();
  const current = (await readInvoice(fixture.db, "tenant1", "invoice1"))!;
  assert.deepEqual(
    await changeInvoice(fixture.db, "tenant1", "user1", current.id, current.version, null),
    { ok: true }
  );
  assert.equal(fixture.state().stock, 5);
  assert.equal(fixture.state().deleted, true);
  assert.equal(fixture.state().audits[0].meta.number, current.number);
  assert.equal(await readInvoice(fixture.db, "tenant1", "invoice1"), null);
});
test("rejects cross-tenant requests and stale edits without changing stock", async () => {
  const fixture = database();
  assert.equal(await readInvoice(fixture.db, "other", "invoice1"), null);
  assert.ok(
    "error" in (await changeInvoice(fixture.db, "other", "user1", "invoice1", "wrong", null))
  );
  assert.ok(
    "error" in (await changeInvoice(fixture.db, "tenant1", "user1", "invoice1", "wrong", input))
  );
  assert.equal(fixture.state().stock, 3);
  assert.equal(fixture.state().audits.length, 0);
});
test("cannot reverse a payment already spent on expenses", async () => {
  const fixture = database();
  fixture.state().expense = 10;
  const current = (await readInvoice(fixture.db, "tenant1", "invoice1"))!;
  const result = await changeInvoice(
    fixture.db,
    "tenant1",
    "user1",
    current.id,
    current.version,
    null
  );
  assert.ok("error" in result && result.error.includes("Cannot reverse"));
  assert.equal(fixture.state().stock, 3);
  assert.equal(fixture.state().deleted, false);
});
test("a failure after stock changes rolls back the whole operation", async () => {
  const fixture = database();
  const current = (await readInvoice(fixture.db, "tenant1", "invoice1"))!;
  fixture.failAudit();
  await assert.rejects(
    changeInvoice(fixture.db, "tenant1", "user1", current.id, current.version, input),
    /Storage failed/
  );
  assert.equal(fixture.state().stock, 3);
  assert.equal(fixture.state().invoice.total, "20.50");
  assert.equal(fixture.state().movements.length, 0);
});
