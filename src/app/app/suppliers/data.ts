import { tenantDb } from "@/lib/tenant-db";

export type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  invoiceCount: number;
  /** Total still owed across this supplier's invoices. */
  outstanding: number;
};

export type PurchaseRow = {
  id: string;
  reference: string | null;
  supplierName: string;
  invoiceDate: Date;
  total: number;
  paid: number;
  outstanding: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
  lineCount: number;
};

export type SupplierOption = { id: string; name: string };
export type ProductOption = { id: string; name: string; serial: number };
export type MethodOption = { id: string; name: string };

function num(value: { toString(): string } | null | undefined): number {
  return value ? Number(value.toString()) : 0;
}

export async function getSuppliers(): Promise<SupplierRow[]> {
  const { db, tenantId } = await tenantDb();

  const suppliers = await db.supplier.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      notes: true,
      purchaseInvoices: {
        select: {
          total: true,
          payments: { select: { amount: true } },
        },
      },
    },
  });

  return suppliers.map((s) => {
    const outstanding = s.purchaseInvoices.reduce((sum, inv) => {
      const total = num(inv.total);
      const paid = inv.payments.reduce((p, pay) => p + num(pay.amount), 0);
      return sum + Math.max(0, total - paid);
    }, 0);

    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      email: s.email,
      address: s.address,
      notes: s.notes,
      invoiceCount: s.purchaseInvoices.length,
      outstanding,
    };
  });
}

export async function getPurchases(page = 1): Promise<PurchaseRow[]> {
  const { db, tenantId } = await tenantDb();

  const invoices = await db.purchaseInvoice.findMany({
    where: { tenantId },
    orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
    take: 100,
    skip: (page - 1) * 100,
    select: {
      id: true,
      reference: true,
      invoiceDate: true,
      total: true,
      status: true,
      supplier: { select: { name: true } },
      payments: { select: { amount: true } },
      _count: { select: { lines: true } },
    },
  });

  return invoices.map((inv) => {
    const total = num(inv.total);
    const paid = inv.payments.reduce((sum, p) => sum + num(p.amount), 0);
    return {
      id: inv.id,
      reference: inv.reference,
      supplierName: inv.supplier.name,
      invoiceDate: inv.invoiceDate,
      total,
      paid,
      outstanding: Math.max(0, total - paid),
      status: inv.status,
      lineCount: inv._count.lines,
    };
  });
}

/** Everything the "new purchase" dialog needs. */
export async function getPurchaseFormData() {
  const { db, tenantId } = await tenantDb();

  const [suppliers, products, methods] = await Promise.all([
    // Newest first, so the dialog can show the 10 most recent before any search.
    db.supplier.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
    db.product.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, serial: true },
    }),
    db.paymentMethod.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return { suppliers, products, methods };
}
