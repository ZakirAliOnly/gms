import { ChevronLeft, ChevronRight, Table2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AdminBranchAction } from "@/components/admin-branch-action";
import { AdminRecordFilters } from "@/components/admin-record-filters";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guards";
import { db } from "@/lib/db";
import { PlatformShell } from "@/components/platform-shell";
import {
  DATASETS,
  DATASET_META,
  getAdminDataset,
  parseDataset,
  type Column,
  type DataRow,
  type DatasetKey,
} from "@/app/app/data/data-sources";
import { getAdminMethodBalances } from "@/app/app/payment-methods/data";
import { formatDate, formatMoneyPrecise } from "@/lib/format";

const modules: Record<
  string,
  { title: string; dataset?: DatasetKey; eyebrow: string; description: string; action: string }
> = {
  memberships: {
    title: "Membership Directory",
    dataset: "members",
    eyebrow: "Gym",
    description: "Manage member profiles, packages, and monthly renewals.",
    action: "Add membership",
  },
  inventory: {
    title: "Inventory",
    dataset: "products",
    eyebrow: "Retail",
    description: "Products, stock levels, and adjustments.",
    action: "Add product",
  },
  invoices: {
    title: "Invoices",
    dataset: "invoices",
    eyebrow: "Retail",
    description: "Sales and invoice history across your branches.",
    action: "New sale",
  },
  suppliers: {
    title: "Suppliers",
    eyebrow: "Purchasing",
    description: "Suppliers, stock purchases, and payments.",
    action: "Add supplier",
  },
  expenses: {
    title: "Expenses",
    dataset: "expenses",
    eyebrow: "Finance",
    description: "Record operating costs and track spending.",
    action: "Record expense",
  },
  "payment-methods": {
    title: "Payment Methods",
    eyebrow: "Finance",
    description: "Balances, payment methods, and transfers.",
    action: "Add method",
  },
  data: {
    title: "Data Viewer",
    eyebrow: "Tools",
    description: "Browse and search records across your branches.",
    action: "Open branch data",
  },
};
const destination: Record<DatasetKey, string> = {
  members: "memberships",
  renewals: "memberships",
  invoices: "invoices",
  products: "inventory",
  stock: "inventory",
  expenses: "expenses",
  transfers: "payment-methods",
};
function cell(row: DataRow, column: Column) {
  const value = row[column.key];
  if (value == null || value === "") return "—";
  if (column.type === "money") return formatMoneyPrecise(Number(value));
  if (column.type === "date") return formatDate(new Date(String(value)));
  return String(value);
}

export default async function AdminModule({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("ADMIN");
  const { module } = await params;
  const config = modules[module];
  if (!config) notFound();
  const sp = await searchParams;
  const value = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "");
  const search = value("q").trim().slice(0, 120);
  const branch = value("branch");
  const requestedPage = Number(value("page"));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const branches = await db.tenant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true },
  });
  if (branch && !branches.some((b) => b.id === branch)) notFound();
  const dataset = config.dataset ?? parseDataset(value("dataset"));
  let columns: Column[];
  let rows: DataRow[];
  let total: number;
  let pageCount: number;
  if (module === "suppliers") {
    const where = {
      ...(branch ? { tenantId: branch } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };
    const [count, records] = await Promise.all([
      db.supplier.count({ where }),
      db.supplier.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (page - 1) * 25,
        take: 25,
        select: {
          name: true,
          phone: true,
          email: true,
          address: true,
          tenant: { select: { id: true, name: true } },
        },
      }),
    ]);
    rows = records.map((r) => ({
      name: r.name,
      phone: r.phone,
      email: r.email,
      address: r.address,
      branch: r.tenant.name,
      branchId: r.tenant.id,
    }));
    columns = ["name", "phone", "email", "address"].map((key) => ({
      key,
      label: key[0].toUpperCase() + key.slice(1),
      type: "text",
    }));
    total = count;
    pageCount = Math.max(1, Math.ceil(total / 25));
  } else if (module === "payment-methods") {
    const methods = (await getAdminMethodBalances(branch || undefined)).filter((m) =>
      m.name.toLowerCase().includes(search.toLowerCase())
    );
    total = methods.length;
    pageCount = Math.max(1, Math.ceil(total / 25));
    rows = methods.slice((page - 1) * 25, page * 25).map((m) => ({
      branch: m.branch,
      branchId: m.branchId,
      name: m.name,
      opening: m.openingBalance,
      balance: m.currentBalance,
      status: m.isActive ? "Active" : "Hidden",
    }));
    columns = [
      { key: "name", label: "Method", type: "text" },
      { key: "opening", label: "Opening balance", type: "money" },
      { key: "balance", label: "Current balance", type: "money" },
      { key: "status", label: "Status", type: "text" },
    ];
  } else {
    const result = await getAdminDataset({ dataset, search, page }, branch || undefined);
    ({ rows, total, pageCount } = result);
    columns = DATASET_META[dataset].columns;
  }
  const workspaceModule = module === "data" ? destination[dataset] : module;
  const query = (nextPage: number) =>
    `?${new URLSearchParams({ q: search, branch, dataset, page: String(nextPage) })}`;
  return (
    <PlatformShell
      role="Admin"
      userName={user.name ?? undefined}
      userEmail={user.email ?? ""}
      home="/admin"
    >
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
        <PageHeader
          eyebrow={config.eyebrow}
          title={config.title}
          description={config.description}
          action={
            <AdminBranchAction
              branches={branches.filter((b) => !branch || b.id === branch)}
              module={module === "data" ? "data" : workspaceModule}
              label={config.action}
            />
          }
        />
        {module === "data" && (
          <nav
            aria-label="Datasets"
            className="border-border mt-4 flex gap-1 overflow-x-auto border-b pb-px"
          >
            {DATASETS.map((d) => (
              <Link
                key={d}
                href={"?" + new URLSearchParams({ dataset: d, branch })}
                aria-current={dataset === d ? "page" : undefined}
                className={
                  "shrink-0 border-b-2 px-3 py-3 text-[13px] transition-colors " +
                  (dataset === d
                    ? "border-primary text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground border-transparent")
                }
              >
                {DATASET_META[d].label}
              </Link>
            ))}
          </nav>
        )}
        <div className="border-border bg-card mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <AdminRecordFilters
            key={module + dataset}
            branches={branches}
            placeholder={
              module === "invoices"
                ? "Search by invoice number..."
                : module === "memberships"
                  ? "Search name, phone, or barcode..."
                  : "Search " + config.title.toLowerCase() + "..."
            }
          />
          <div className="text-muted-foreground flex items-center gap-2 text-[13px]">
            <span>
              {total === 0
                ? "No results"
                : "Showing " +
                  ((page - 1) * 25 + 1) +
                  "-" +
                  Math.min(page * 25, total) +
                  " of " +
                  total}
            </span>
            <nav aria-label="Pagination" className="ml-2 flex gap-1">
              {page > 1 ? (
                <Link
                  href={query(page - 1)}
                  aria-label="Previous page"
                  className="border-border hover:border-primary hover:text-primary flex size-8 items-center justify-center rounded border transition-colors"
                >
                  <ChevronLeft className="size-4" />
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  aria-label="Previous page"
                  className="border-border flex size-8 items-center justify-center rounded border opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </span>
              )}
              {page < pageCount ? (
                <Link
                  href={query(page + 1)}
                  aria-label="Next page"
                  className="border-border hover:border-primary hover:text-primary flex size-8 items-center justify-center rounded border transition-colors"
                >
                  <ChevronRight className="size-4" />
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  aria-label="Next page"
                  className="border-border flex size-8 items-center justify-center rounded border opacity-40"
                >
                  <ChevronRight className="size-4" />
                </span>
              )}
            </nav>
          </div>
        </div>
        <div className="border-border bg-card mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead className="bg-secondary border-border border-b">
              <tr>
                <th className="label-caps text-muted-foreground px-4 py-3 font-medium">Branch</th>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`label-caps text-muted-foreground px-4 py-3 font-medium ${c.numeric || c.type === "money" ? "text-right" : ""}`}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="label-caps text-muted-foreground px-4 py-3 font-medium">Manage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-border hover:bg-secondary/40 border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{r.branch}</td>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-3 ${c.numeric || c.type === "money" ? "data-mono text-right" : ""}`}
                    >
                      {cell(r, c)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    {branches.find((b) => b.id === r.branchId)?.status === "ACTIVE" ? (
                      <Link
                        href={`/admin/branches/${r.branchId}/${workspaceModule}`}
                        className="text-primary hover:border-primary border-border hover:bg-primary/5 rounded border px-3 py-2 transition-colors"
                        aria-label={`Manage ${config.title} in ${r.branch}`}
                      >
                        Open branch
                      </Link>
                    ) : (
                      "Suspended"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <Table2 className="text-muted-foreground/40 mb-3 size-8" aria-hidden="true" />
              <h2 className="text-sm font-medium">No records found</h2>
              <p className="text-muted-foreground mt-1 text-[13px]">
                Try a different search or select another branch.
              </p>
            </div>
          )}
        </div>
      </main>
    </PlatformShell>
  );
}
