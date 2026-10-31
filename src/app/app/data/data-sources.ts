import { db } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import type { Prisma } from "@/generated/prisma/client";
import { tenantDb } from "@/lib/tenant-db";

/**
 * The Data Viewer (FR-49, FR-50).
 *
 * A read-only window over the tenant's own records. Every query goes through
 * tenantDb and filters on tenantId - the viewer can never reach another
 * location's data, and it never writes.
 */

export const DATASETS = [
  "members",
  "renewals",
  "invoices",
  "products",
  "stock",
  "expenses",
  "transfers",
] as const;

export type DatasetKey = (typeof DATASETS)[number];

export type ColumnType = "text" | "money" | "date" | "number";

export type Column = {
  key: string;
  label: string;
  type: ColumnType;
  /** Right-align and use tabular figures. */
  numeric?: boolean;
};

export type DatasetMeta = {
  key: DatasetKey;
  label: string;
  description: string;
  columns: Column[];
  /** Field the date-range filter applies to, when the dataset has one. */
  dateLabel?: string;
};

export const DATASET_META: Record<DatasetKey, DatasetMeta> = {
  members: {
    key: "members",
    label: "Members",
    description: "Member profiles with their membership and package.",
    dateLabel: "Joined",
    columns: [
      { key: "name", label: "Name", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "barcode", label: "Barcode", type: "text" },
      { key: "packageName", label: "Package", type: "text" },
      { key: "status", label: "Status", type: "text" },
      { key: "nextRenewalDate", label: "Next renewal", type: "date", numeric: true },
      { key: "joinDate", label: "Joined", type: "date", numeric: true },
    ],
  },
  renewals: {
    key: "renewals",
    label: "Renewal payments",
    description: "Money taken for monthly membership renewals.",
    dateLabel: "Recorded",
    columns: [
      { key: "memberName", label: "Member", type: "text" },
      { key: "barcode", label: "Barcode", type: "text" },
      { key: "amount", label: "Amount", type: "money", numeric: true },
      { key: "paymentMethod", label: "Method", type: "text" },
      { key: "recordedAt", label: "Recorded", type: "date", numeric: true },
    ],
  },
  invoices: {
    key: "invoices",
    label: "Retail invoices",
    description: "Point-of-sale invoices and their totals.",
    dateLabel: "Sold",
    columns: [
      { key: "number", label: "Invoice", type: "text" },
      { key: "memberName", label: "Member", type: "text" },
      { key: "itemCount", label: "Items", type: "number", numeric: true },
      { key: "subtotal", label: "Subtotal", type: "money", numeric: true },
      { key: "discount", label: "Discount", type: "money", numeric: true },
      { key: "total", label: "Total", type: "money", numeric: true },
      { key: "paymentMethod", label: "Method", type: "text" },
      { key: "soldAt", label: "Sold", type: "date", numeric: true },
    ],
  },
  products: {
    key: "products",
    label: "Products",
    description: "Retail catalogue with current stock levels.",
    columns: [
      { key: "serial", label: "#", type: "text" },
      { key: "name", label: "Product", type: "text" },
      { key: "category", label: "Category", type: "text" },
      { key: "costPrice", label: "Cost", type: "money", numeric: true },
      { key: "salePrice", label: "Price", type: "money", numeric: true },
      { key: "quantity", label: "In stock", type: "number", numeric: true },
      { key: "status", label: "Status", type: "text" },
    ],
  },
  stock: {
    key: "stock",
    label: "Stock movements",
    description: "Every change to stock, with the document behind it.",
    dateLabel: "Date",
    columns: [
      { key: "productName", label: "Product", type: "text" },
      { key: "quantityDelta", label: "Change", type: "number", numeric: true },
      { key: "type", label: "Type", type: "text" },
      { key: "reason", label: "Reason", type: "text" },
      { key: "createdAt", label: "Date", type: "date", numeric: true },
    ],
  },
  expenses: {
    key: "expenses",
    label: "Expenses",
    description: "Operating costs and what they were paid from.",
    dateLabel: "Spent",
    columns: [
      { key: "category", label: "Category", type: "text" },
      { key: "description", label: "Description", type: "text" },
      { key: "amount", label: "Amount", type: "money", numeric: true },
      { key: "paymentMethod", label: "Paid from", type: "text" },
      { key: "spentAt", label: "Spent", type: "date", numeric: true },
    ],
  },
  transfers: {
    key: "transfers",
    label: "Transfers",
    description: "Money moved between payment methods.",
    dateLabel: "Date",
    columns: [
      { key: "fromMethod", label: "From", type: "text" },
      { key: "toMethod", label: "To", type: "text" },
      { key: "amount", label: "Amount", type: "money", numeric: true },
      { key: "note", label: "Note", type: "text" },
      { key: "transferredAt", label: "Date", type: "date", numeric: true },
    ],
  },
};

export function parseDataset(value: string | undefined): DatasetKey {
  return (DATASETS as readonly string[]).includes(value ?? "") ? (value as DatasetKey) : "members";
}

/** A row is a flat map of column key to primitive - ready for table or CSV. */
export type DataRow = Record<string, string | number | null>;

export type DatasetResult = {
  rows: DataRow[];
  total: number;
  page: number;
  pageCount: number;
};

export const PAGE_SIZE = 25;

function money(value: { toString(): string } | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value.toString());
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

type Query = {
  dataset: DatasetKey;
  search: string;
  from?: string;
  to?: string;
  page: number;
  /** Fetch everything for export rather than one page. */
  all?: boolean;
};

/** Inclusive of the whole "to" day, so a single-day range returns that day. */
function dateWindow(from?: string, to?: string) {
  const window: { gte?: Date; lt?: Date } = {};
  if (from) window.gte = new Date(`${from}T00:00:00`);
  if (to) {
    const end = new Date(`${to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    window.lt = end;
  }
  return Object.keys(window).length ? window : undefined;
}

export async function getDataset(query: Query): Promise<DatasetResult> {
  const { tenantId } = await tenantDb("data");
  return queryDataset(query, tenantId);
}

export async function getAdminDataset(query: Query, branch?: string) {
  await requireRole("ADMIN");
  return queryDataset(query, branch);
}

async function queryDataset(query: Query, tenantId?: string): Promise<DatasetResult> {
  const { dataset, search, from, to, page, all } = query;

  const q = search.trim();
  const window = dateWindow(from, to);
  const take = all ? 5000 : PAGE_SIZE;
  const skip = all ? 0 : (page - 1) * PAGE_SIZE;

  const contains = (value: string): Prisma.StringFilter => ({
    contains: value,
    mode: "insensitive",
  });

  if (dataset === "members") {
    const where: Prisma.MemberWhereInput = {
      tenantId,
      ...(window ? { joinDate: window } : {}),
      ...(q
        ? {
            OR: [
              { name: contains(q) },
              { phone: contains(q) },
              { email: contains(q) },
              { barcode: contains(q) },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      db.member.count({ where }),
      db.member.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take,
        select: {
          tenant: { select: { id: true, name: true } },
          name: true,
          phone: true,
          email: true,
          barcode: true,
          joinDate: true,
          membership: {
            select: {
              status: true,
              nextRenewalDate: true,
              package: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    return paged(
      rows.map((r) => ({
        branch: r.tenant.name,
        branchId: r.tenant.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        barcode: r.barcode,
        packageName: r.membership?.package.name ?? null,
        status: r.membership?.status ?? null,
        nextRenewalDate: iso(r.membership?.nextRenewalDate),
        joinDate: iso(r.joinDate),
      })),
      total,
      page,
      all
    );
  }

  if (dataset === "renewals") {
    const where: Prisma.RenewalPaymentWhereInput = {
      tenantId,
      ...(window ? { recordedAt: window } : {}),
      ...(q
        ? {
            membership: {
              member: { OR: [{ name: contains(q) }, { barcode: contains(q) }] },
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      db.renewalPayment.count({ where }),
      db.renewalPayment.findMany({
        where,
        orderBy: { recordedAt: "desc" },
        skip,
        take,
        select: {
          tenant: { select: { id: true, name: true } },
          amount: true,
          recordedAt: true,
          paymentMethod: { select: { name: true } },
          membership: { select: { member: { select: { name: true, barcode: true } } } },
        },
      }),
    ]);

    return paged(
      rows.map((r) => ({
        branch: r.tenant.name,
        branchId: r.tenant.id,
        memberName: r.membership.member.name,
        barcode: r.membership.member.barcode,
        amount: money(r.amount),
        paymentMethod: r.paymentMethod.name,
        recordedAt: iso(r.recordedAt),
      })),
      total,
      page,
      all
    );
  }

  if (dataset === "invoices") {
    const where: Prisma.RetailInvoiceWhereInput = {
      tenantId,
      ...(window ? { soldAt: window } : {}),
      ...(q ? { OR: [{ number: contains(q) }, { member: { name: contains(q) } }] } : {}),
    };

    const [total, rows] = await Promise.all([
      db.retailInvoice.count({ where }),
      db.retailInvoice.findMany({
        where,
        orderBy: { soldAt: "desc" },
        skip,
        take,
        select: {
          tenant: { select: { id: true, name: true } },
          number: true,
          subtotal: true,
          discount: true,
          total: true,
          soldAt: true,
          member: { select: { name: true } },
          paymentMethod: { select: { name: true } },
          _count: { select: { lines: true } },
        },
      }),
    ]);

    return paged(
      rows.map((r) => ({
        branch: r.tenant.name,
        branchId: r.tenant.id,
        number: r.number,
        memberName: r.member?.name ?? null,
        itemCount: r._count.lines,
        subtotal: money(r.subtotal),
        discount: money(r.discount),
        total: money(r.total),
        paymentMethod: r.paymentMethod.name,
        soldAt: iso(r.soldAt),
      })),
      total,
      page,
      all
    );
  }

  if (dataset === "products") {
    const where: Prisma.ProductWhereInput = {
      tenantId,
      ...(q ? { OR: [{ name: contains(q) }, { category: contains(q) }] } : {}),
    };

    const [total, rows] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        orderBy: { serial: "asc" },
        skip,
        take,
        select: {
          tenant: { select: { id: true, name: true } },
          serial: true,
          name: true,
          category: true,
          costPrice: true,
          salePrice: true,
          quantity: true,
          isActive: true,
        },
      }),
    ]);

    return paged(
      rows.map((r) => ({
        branch: r.tenant.name,
        branchId: r.tenant.id,
        serial: String(r.serial).padStart(3, "0"),
        name: r.name,
        category: r.category,
        costPrice: money(r.costPrice),
        salePrice: money(r.salePrice),
        quantity: r.quantity,
        status: r.isActive ? "Active" : "Hidden",
      })),
      total,
      page,
      all
    );
  }

  if (dataset === "stock") {
    const where: Prisma.StockMovementWhereInput = {
      tenantId,
      ...(window ? { createdAt: window } : {}),
      ...(q ? { OR: [{ product: { name: contains(q) } }, { reason: contains(q) }] } : {}),
    };

    const [total, rows] = await Promise.all([
      db.stockMovement.count({ where }),
      db.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: {
          tenant: { select: { id: true, name: true } },
          quantityDelta: true,
          type: true,
          reason: true,
          createdAt: true,
          product: { select: { name: true } },
        },
      }),
    ]);

    return paged(
      rows.map((r) => ({
        branch: r.tenant.name,
        branchId: r.tenant.id,
        productName: r.product.name,
        quantityDelta: r.quantityDelta,
        type: r.type,
        reason: r.reason,
        createdAt: iso(r.createdAt),
      })),
      total,
      page,
      all
    );
  }

  if (dataset === "expenses") {
    const where: Prisma.ExpenseWhereInput = {
      tenantId,
      ...(window ? { spentAt: window } : {}),
      ...(q ? { OR: [{ description: contains(q) }, { category: { name: contains(q) } }] } : {}),
    };

    const [total, rows] = await Promise.all([
      db.expense.count({ where }),
      db.expense.findMany({
        where,
        orderBy: { spentAt: "desc" },
        skip,
        take,
        select: {
          tenant: { select: { id: true, name: true } },
          amount: true,
          description: true,
          spentAt: true,
          category: { select: { name: true } },
          paymentMethod: { select: { name: true } },
        },
      }),
    ]);

    return paged(
      rows.map((r) => ({
        branch: r.tenant.name,
        branchId: r.tenant.id,
        category: r.category.name,
        description: r.description,
        amount: money(r.amount),
        paymentMethod: r.paymentMethod.name,
        spentAt: iso(r.spentAt),
      })),
      total,
      page,
      all
    );
  }

  // transfers
  const where: Prisma.PaymentTransferWhereInput = {
    tenantId,
    ...(window ? { transferredAt: window } : {}),
    ...(q
      ? {
          OR: [
            { note: contains(q) },
            { fromMethod: { name: contains(q) } },
            { toMethod: { name: contains(q) } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.paymentTransfer.count({ where }),
    db.paymentTransfer.findMany({
      where,
      orderBy: { transferredAt: "desc" },
      skip,
      take,
      select: {
        tenant: { select: { id: true, name: true } },
        amount: true,
        note: true,
        transferredAt: true,
        fromMethod: { select: { name: true } },
        toMethod: { select: { name: true } },
      },
    }),
  ]);

  return paged(
    rows.map((r) => ({
      branch: r.tenant.name,
      branchId: r.tenant.id,
      fromMethod: r.fromMethod.name,
      toMethod: r.toMethod.name,
      amount: money(r.amount),
      note: r.note,
      transferredAt: iso(r.transferredAt),
    })),
    total,
    page,
    all
  );
}

function paged(rows: DataRow[], total: number, page: number, all?: boolean): DatasetResult {
  return {
    rows,
    total,
    page: all ? 1 : page,
    pageCount: all ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}
