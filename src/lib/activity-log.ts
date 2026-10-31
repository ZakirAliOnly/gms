import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { startOfToday, startOfDaysFromNow, startOfTomorrow } from "./dates";
import { formatMoneyPrecise } from "./format";

export const ACTIVITY_PAGE_SIZE = 25;
export const ACTIVITY_LABELS: Record<string, string> = {
  "tenant.create": "Gym created",
  BRANCH_USER_CREATE: "Branch user created",
  BRANCH_USER_UPDATE: "Branch user access updated",
  RETAIL_INVOICE_EDIT: "Invoice edited",
  RETAIL_INVOICE_DELETE: "Invoice deleted",
  RETAIL_INVOICE_CREATE: "Invoice created",
  MEMBERSHIP_CREATE: "Admission payment",
  MEMBERSHIP_EDIT: "Membership edited",
  MEMBERSHIP_RENEW: "Renewal payment",
  MEMBERSHIP_EXTRAS: "Membership extras changed",
  EXPENSE_CREATE: "Expense recorded",
  EXPENSE_DELETE: "Expense deleted",
  EXPENSE_CATEGORY_CREATE: "Expense category created",
  PRODUCT_CREATE: "Product created",
  PRODUCT_EDIT: "Product edited",
  PRODUCT_STATUS: "Product status changed",
  STOCK_ADJUST: "Stock adjusted",
  SUPPLIER_CREATE: "Supplier created",
  SUPPLIER_EDIT: "Supplier edited",
  PURCHASE_CREATE: "Purchase invoice created",
  PURCHASE_PAYMENT: "Supplier payment recorded",
  TRANSFER_CREATE: "Transfer recorded",
  TRANSFER_DELETE: "Transfer deleted",
  PAYMENT_METHOD_CREATE: "Payment method created",
  PAYMENT_METHOD_EDIT: "Payment method edited",
  PAYMENT_METHOD_STATUS: "Payment method status changed",
  PACKAGE_CREATE: "Package created",
  PACKAGE_EDIT: "Package edited",
  PACKAGE_STATUS: "Package status changed",
  EXTRA_CREATE: "Extra created",
  EXTRA_EDIT: "Extra edited",
  EXTRA_STATUS: "Extra status changed",
};

export function activityLabel(action: string): string {
  return Object.hasOwn(ACTIVITY_LABELS, action)
    ? ACTIVITY_LABELS[action]
    : action.replace(/[_.]/g, " ").toLowerCase();
}

export function parseActivityFilters(params: Record<string, string | string[] | undefined>) {
  const first = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const page = Number(first("page"));
  return {
    range: ["today", "7", "30", "90", "all"].includes(first("range")) ? first("range") : "30",
    q: first("q").trim().slice(0, 120),
    action: first("action").trim().slice(0, 100),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

function metadataText(meta: Prisma.JsonValue, key: string): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const value = meta[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

/** Show only fields intentionally recorded for display, never arbitrary JSON. */
export function activitySummary(action: string, target: string, meta: Prisma.JsonValue) {
  const number = metadataText(meta, "number");
  const money = (key: string) => {
    const value = metadataText(meta, key);
    return value !== null && value.trim() !== "" && Number.isFinite(Number(value))
      ? formatMoneyPrecise(value)
      : null;
  };
  if (action === "RETAIL_INVOICE_EDIT") {
    const before = money("previousTotal");
    const after = money("total");
    return {
      record: number ?? target,
      detail: before && after ? `Total: ${before} → ${after}` : "Invoice details updated.",
    };
  }
  if (action === "RETAIL_INVOICE_DELETE") {
    const before = money("previousTotal");
    return {
      record: number ?? target,
      detail: before ? `Removed invoice total: ${before}` : "Invoice removed.",
    };
  }
  if (action === "tenant.create") {
    return {
      record: metadataText(meta, "name") ?? target,
      detail: "Gym location and login account created.",
    };
  }
  const name = metadataText(meta, "name") ?? metadataText(meta, "customer");
  const amount = money("amount") ?? money("total") ?? money("price") ?? money("fee");
  const active =
    meta && typeof meta === "object" && !Array.isArray(meta) ? meta.isActive : undefined;
  const delta = metadataText(meta, "delta");
  return {
    record: [name, number].filter(Boolean).join(" · ") || target,
    detail: amount
      ? `${activityLabel(action)} · ${amount}`
      : delta !== null
        ? `Stock change: ${delta}`
        : typeof active === "boolean"
          ? active
            ? "Active"
            : "Archived"
          : activityLabel(action),
  };
}

export type ActivityFilters = { q: string; action: string; page: number; range?: string };
type ActivityScope = { tenantId: string } | { admin: true; tenantId?: string };

export async function getActivityLog(
  db: Pick<PrismaClient, "auditLog" | "user">,
  tenantId: string,
  filters: ActivityFilters
) {
  return queryActivityLog(db, { tenantId }, filters);
}

/** Server data query. The admin entry point must requireRole("ADMIN") first. */
export async function queryActivityLog(
  db: Pick<PrismaClient, "auditLog" | "user">,
  scope: ActivityScope,
  filters: ActivityFilters
) {
  const tenantId = scope.tenantId;
  const admin = "admin" in scope && scope.admin;
  const { where, locationScope } = await activityWhere(db, scope, filters);
  const [total, actions] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.groupBy({
      by: ["action"],
      where: locationScope,
      orderBy: { action: "asc" },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const entries = await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ACTIVITY_PAGE_SIZE,
    take: ACTIVITY_PAGE_SIZE,
    select: {
      id: true,
      tenantId: true,
      actorId: true,
      action: true,
      target: true,
      meta: true,
      createdAt: true,
    },
  });
  const actors = entries.length
    ? await db.user.findMany({
        where: {
          id: { in: [...new Set(entries.map((entry) => entry.actorId))] },
          ...(!admin
            ? { OR: [{ tenantId }, { role: { in: ["SUPERADMIN", "ADMIN"] }, tenantId: null }] }
            : {}),
        },
        select: { id: true, name: true, role: true },
      })
    : [];
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  return {
    total,
    page,
    pageCount,
    actions: actions.map((row) => row.action),
    rows: entries.map((entry) => {
      const actor = actorById.get(entry.actorId);
      return {
        id: entry.id,
        tenantId: entry.tenantId,
        createdAt: entry.createdAt,
        action: entry.action,
        actorId: entry.actorId,
        money: activityMoney(entry.action, entry.meta),
        method:
          metadataText(entry.meta, "paymentMethod") ?? metadataText(entry.meta, "status") ?? "—",
        actor:
          actor?.name ||
          (actor?.role === "SUPERADMIN" ? "Platform administrator" : "Unavailable user"),
        ...activitySummary(entry.action, entry.target, entry.meta),
      };
    }),
  };
}

async function activityWhere(
  db: Pick<PrismaClient, "auditLog" | "user">,
  scope: ActivityScope,
  filters: ActivityFilters
) {
  const tenantId = scope.tenantId;
  const admin = "admin" in scope && scope.admin;
  if (!admin && !tenantId) throw new Error("Tenant scope required.");
  // AuditLog keeps actorId without a User relation. Resolve excluded actors
  // first, then apply the same scope to rows, totals, and filter options.
  const superadmins = admin
    ? await db.user.findMany({ where: { role: "SUPERADMIN" }, select: { id: true } })
    : [];
  const locationScope: Prisma.AuditLogWhereInput = {
    ...(tenantId ? { tenantId } : { tenantId: { not: null } }),
    ...(superadmins.length ? { actorId: { notIn: superadmins.map((user) => user.id) } } : {}),
  };
  const sqlClauses: Prisma.Sql[] = [
    tenantId ? Prisma.sql`"tenantId" = ${tenantId}` : Prisma.sql`"tenantId" IS NOT NULL`,
  ];
  if (superadmins.length) sqlClauses.push(Prisma.sql`"actorId" NOT IN (${Prisma.join(superadmins.map((user) => user.id))})`);
  if (filters.range && filters.range !== "all") {
    const from = filters.range === "today" ? startOfToday() : startOfDaysFromNow(1 - Number(filters.range));
    sqlClauses.push(Prisma.sql`"createdAt" >= ${from} AND "createdAt" < ${startOfTomorrow()}`);
  }
  if (filters.action) sqlClauses.push(Prisma.sql`action = ${filters.action}`);
  const where: Prisma.AuditLogWhereInput = {
    ...locationScope,
    ...(filters.range && filters.range !== "all"
      ? {
          createdAt: {
            gte:
              filters.range === "today"
                ? startOfToday()
                : startOfDaysFromNow(1 - Number(filters.range)),
            lt: startOfTomorrow(),
          },
        }
      : {}),
    ...(filters.action ? { action: filters.action } : {}),
  };
  if (filters.q) {
    const search = { contains: filters.q, mode: "insensitive" as const };
    // Use the same LIKE pattern as Prisma contains.
    const pattern = `%${filters.q}%`;
    const matchingActions = Object.entries(ACTIVITY_LABELS)
      .filter(([, label]) => label.toLowerCase().includes(filters.q.toLowerCase()))
      .map(([action]) => action);
    sqlClauses.push(Prisma.sql`(
      action ILIKE ${pattern} OR target ILIKE ${pattern} OR "actorId" ILIKE ${pattern}
      OR ${matchingActions.length ? Prisma.sql`action IN (${Prisma.join(matchingActions)})` : Prisma.sql`FALSE`}
      OR (jsonb_typeof(meta->'number') = 'string' AND meta->>'number' ILIKE ${pattern})
      OR (jsonb_typeof(meta->'name') = 'string' AND meta->>'name' ILIKE ${pattern})
      OR (jsonb_typeof(meta->'customer') = 'string' AND meta->>'customer' ILIKE ${pattern})
    )`);
    where.OR = [
      { action: search },
      { target: search },
      { actorId: search },
      {
        action: {
          in: Object.entries(ACTIVITY_LABELS)
            .filter(([, label]) => label.toLowerCase().includes(filters.q.toLowerCase()))
            .map(([action]) => action),
        },
      },
      { meta: { path: ["number"], string_contains: filters.q, mode: "insensitive" } },
      { meta: { path: ["name"], string_contains: filters.q, mode: "insensitive" } },
      { meta: { path: ["customer"], string_contains: filters.q, mode: "insensitive" } },
    ];
  }
  return { where, locationScope, sqlWhere: Prisma.join(sqlClauses, " AND ") };
}

export function activityMoney(action: string, meta: Prisma.JsonValue) {
  const raw =
    metadataText(meta, "amount") ??
    metadataText(meta, "total") ??
    metadataText(meta, "previousTotal");
  const amount =
    raw !== null && raw.trim() !== "" && Number.isFinite(Number(raw)) ? Number(raw) : null;
  const outgoing = [
    "EXPENSE_CREATE",
    "PURCHASE_PAYMENT",
    "PURCHASE_CREATE",
    "RETAIL_INVOICE_DELETE",
  ].includes(action);
  const incoming = [
    "MEMBERSHIP_CREATE",
    "MEMBERSHIP_RENEW",
    "RETAIL_INVOICE_CREATE",
    "EXPENSE_DELETE",
  ].includes(action);
  if (action === "RETAIL_INVOICE_EDIT") {
    const beforeText = metadataText(meta, "previousTotal");
    const afterText = metadataText(meta, "total");
    if (beforeText === null || afterText === null) return { amount: null, direction: "neutral" };
    const before = Number(beforeText);
    const after = Number(afterText);
    const delta = Number.isFinite(before) && Number.isFinite(after) ? after - before : 0;
    return { amount: Math.abs(delta), direction: delta < 0 ? "out" : "in" };
  }
  return { amount, direction: outgoing ? "out" : incoming ? "in" : "neutral" };
}
export async function activityMetrics(
  db: Pick<PrismaClient, "auditLog" | "user" | "$queryRaw">,
  scope: ActivityScope,
  filters: ActivityFilters
) {
  const { sqlWhere } = await activityWhere(db, scope, filters);
  // Only one totals row crosses the database boundary, regardless of log size.
  const value = (key: string) => Prisma.sql`CASE WHEN jsonb_typeof(meta->${key}) IN ('string', 'number') THEN meta->${key} END`;
  const numeric = (expression: Prisma.Sql) => Prisma.sql`CASE
    WHEN jsonb_typeof(${expression}) = 'number' THEN (${expression})::numeric
    WHEN jsonb_typeof(${expression}) = 'string' AND btrim(${expression} #>> '{}') ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
      THEN (${expression} #>> '{}')::numeric ELSE NULL END`;
  const [row] = await db.$queryRaw<{
    events: bigint; invoices: bigint; deletions: bigint;
    invoiceAmount: Prisma.Decimal; cashIn: Prisma.Decimal; cashOut: Prisma.Decimal;
  }[]>(Prisma.sql`
    SELECT COUNT(*) AS events,
      COUNT(*) FILTER (WHERE action = 'RETAIL_INVOICE_CREATE') AS invoices,
      COUNT(*) FILTER (WHERE action LIKE '%DELETE') AS deletions,
      COALESCE(SUM(CASE WHEN action = 'RETAIL_INVOICE_CREATE' THEN ${numeric(value("total"))} END), 0) AS "invoiceAmount",
      COALESCE(SUM(CASE
        WHEN action IN ('MEMBERSHIP_CREATE','MEMBERSHIP_RENEW','RETAIL_INVOICE_CREATE','EXPENSE_DELETE')
          THEN ${numeric(Prisma.sql`COALESCE(${value("amount")}, ${value("total")}, ${value("previousTotal")})`)}
        WHEN action = 'RETAIL_INVOICE_EDIT'
          THEN GREATEST(${numeric(value("total"))} - ${numeric(value("previousTotal"))}, 0)
        ELSE 0 END), 0) AS "cashIn",
      COALESCE(SUM(CASE
        WHEN action IN ('EXPENSE_CREATE','PURCHASE_PAYMENT','PURCHASE_CREATE','RETAIL_INVOICE_DELETE')
          THEN ${numeric(Prisma.sql`COALESCE(${value("amount")}, ${value("total")}, ${value("previousTotal")})`)}
        WHEN action = 'RETAIL_INVOICE_EDIT'
          THEN GREATEST(${numeric(value("previousTotal"))} - ${numeric(value("total"))}, 0)
        ELSE 0 END), 0) AS "cashOut"
    FROM "AuditLog" WHERE ${sqlWhere}
  `);
  return {
    events: Number(row.events), invoices: Number(row.invoices), deletions: Number(row.deletions),
    invoiceAmount: Number(row.invoiceAmount), cashIn: Number(row.cashIn), cashOut: Number(row.cashOut),
  };
}
