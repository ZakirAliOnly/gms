import Link from "@/components/workspace-link";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { getTenantContext } from "@/lib/tenant-context";
import { tenantDb } from "@/lib/tenant-db";
import { PageHeader } from "@/components/page-header";
import {
  getAllExtras,
  getActiveExtras,
  getAllPackages,
  getMemberships,
  parseTab,
  PAGE_SIZE,
} from "./data";
import { AddMemberDialog } from "./add-member-dialog";
import { PackagesDialog } from "./packages-dialog";
import { ExtrasDialog } from "./extras-dialog";
import { MembershipTable } from "./membership-table";
import { FilterToolbar } from "@/components/filter-toolbar";
import { SearchBox } from "./search-box";

export const metadata = { title: "Memberships" };

const TABS = [
  { key: "active", label: "Active members" },
  { key: "renewals", label: "Due this week" },
  { key: "overdue", label: "Overdue" },
  { key: "expired", label: "Expired" },
] as const;

export default async function MembershipsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    page?: string;
    scan?: string;
    action?: string;
  }>;
}) {
  await getTenantContext();

  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const query = sp.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { db, tenantId } = await tenantDb();

  const [list, packages, extras, activeExtras, paymentMethods] = await Promise.all([
    getMemberships({ tab, query, page, scan: sp.scan === "1" }),
    getAllPackages(),
    getAllExtras(),
    getActiveExtras(),
    db.paymentMethod.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Active packages, for assigning to new members.
  const activePackages = packages.filter((p) => p.isActive);

  // The edit form also needs any package a currently-listed member sits on,
  // even if it was retired since they joined.
  const usedPackageIds = new Set(list.rows.map((r) => r.packageId));
  const editablePackages = [
    ...activePackages,
    ...packages.filter((p) => !p.isActive && usedPackageIds.has(p.id)),
  ];

  const from = list.total === 0 ? 0 : (list.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(list.page * PAGE_SIZE, list.total);

  function href(next: { tab?: string; page?: number }) {
    const p = new URLSearchParams();
    p.set("tab", next.tab ?? tab);
    if (sp.scan === "1" && !next.tab) p.set("scan", "1");
    if (query) p.set("q", query);
    if (next.page && next.page > 1) p.set("page", String(next.page));
    return `/app/memberships?${p}`;
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Gym"
        title="Membership Directory"
        description="Manage member profiles, packages, and monthly renewals."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PackagesDialog packages={packages} />
            <ExtrasDialog extras={extras} />
            <AddMemberDialog
              key={sp.action ?? "default"}
              initiallyOpen={sp.action === "add"}
              packages={activePackages}
              extras={activeExtras}
              paymentMethods={paymentMethods}
            />
          </div>
        }
      />

      {/* Tabs */}
      <div className="border-border mt-4 flex gap-6 overflow-x-auto border-b">
        {TABS.map((t) => {
          const active = t.key === tab;
          const count = list.counts[t.key];
          return (
            <Link
              key={t.key}
              href={href({ tab: t.key, page: 1 })}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 border-b-[3px] pb-3 text-sm transition-colors ${
                active
                  ? "border-primary text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span
                  className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${
                    t.key === "renewals"
                      ? "bg-destructive text-white"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Toolbar */}
      {sp.scan === "1" && (
        <p className="text-muted-foreground mt-4 text-sm">
          Scan mode searches all members, including overdue memberships.
        </p>
      )}
      <FilterToolbar>
        <SearchBox tab={tab} scan={sp.scan === "1"} />
        <div className="text-muted-foreground flex items-center gap-2 text-[13px]">
          <span>{list.total === 0 ? "No results" : `Showing ${from}–${to} of ${list.total}`}</span>
          <div className="ml-2 flex gap-1">
            <PageLink
              href={href({ page: list.page - 1 })}
              disabled={list.page <= 1}
              label="Previous page"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </PageLink>
            <PageLink
              href={href({ page: list.page + 1 })}
              disabled={list.page >= list.pageCount}
              label="Next page"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </PageLink>
          </div>
        </div>
      </FilterToolbar>

      {/* Table */}
      <div className="mt-4">
        {list.rows.length === 0 ? (
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-lg border px-6 py-16 text-center">
            <Users className="text-muted-foreground/50 size-8" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">
              {query ? "No members match that search" : "Nothing here yet"}
            </p>
            <p className="text-muted-foreground mt-1 text-[13px] leading-[18px]">
              {query
                ? "Try a different name, phone number, or barcode."
                : tab === "active"
                  ? "Add a member to get started."
                  : "Nothing in this tab right now."}
            </p>
          </div>
        ) : null}
        <MembershipTable
          rows={list.rows}
          paymentMethods={paymentMethods}
          packages={editablePackages}
          extras={activeExtras}
        />
      </div>

      {paymentMethods.length === 0 && list.rows.length > 0 && (
        <p className="text-muted-foreground mt-3 text-[13px] leading-[18px]">
          Renewals need a payment method.{" "}
          <Link href="/app/payment-methods" className="text-primary hover:underline">
            Add one
          </Link>{" "}
          to start recording payments.
        </p>
      )}
    </main>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "flex size-8 items-center justify-center rounded border border-border transition-colors";

  if (disabled) {
    return (
      <span aria-disabled="true" className={`${className} opacity-40`}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={`${className} hover:border-primary hover:text-primary`}
    >
      {children}
    </Link>
  );
}
