import Link from "next/link";
import Form from "next/form";
import { History } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { PlatformShell } from "@/components/platform-shell";
import { LOCALE, TIME_ZONE } from "@/lib/format";
import {
  ACTIVITY_PAGE_SIZE,
  activityLabel,
  queryActivityLog,
  parseActivityFilters,
} from "@/lib/activity-log";

export const metadata = { title: "Activity Log" };
const dateTime = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "medium",
});
const input =
  "w-full rounded border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
const button =
  "rounded border border-border px-4 py-2.5 text-sm hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary";

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("ADMIN");
  const params = await searchParams;
  const filters = parseActivityFilters(params);
  const rawLocation = Array.isArray(params.location) ? params.location[0] : params.location;
  const location = rawLocation?.trim() ?? "";
  const [result, locations] = await Promise.all([
    queryActivityLog(db, { admin: true, ...(location ? { tenantId: location } : {}) }, filters),
    db.tenant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const locationNames = new Map(locations.map((gym) => [gym.id, gym.name]));
  const filtered = Boolean(filters.q || filters.action || location);
  const href = (page: number) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.action) params.set("action", filters.action);
    if (location) params.set("location", location);
    params.set("page", String(page));
    return `/admin/activity-log?${params}`;
  };
  const actions = [...new Set([...result.actions, ...(filters.action ? [filters.action] : [])])];
  return (
    <PlatformShell
      role="Admin"
      userName={user.name ?? undefined}
      userEmail={user.email ?? ""}
      home="/admin"
    >
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
        <PageHeader
          title="Activity Log"
          description="Activity across gym locations, newest first. Times are shown in Pakistan time."
        />
        <p className="text-muted-foreground mt-4 text-[13px]">
          New actions are logged from this update onward. Older actions appear only if they were
          already logged.
        </p>
        <Form
          key={`${filters.q}:${filters.action}:${location}`}
          action="/admin/activity-log"
          className="border-border bg-card mt-5 flex flex-wrap items-end gap-3 rounded border p-4"
        >
          <label className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
            <span className="label-caps text-muted-foreground">Search activity</span>
            <input
              name="q"
              type="search"
              maxLength={120}
              defaultValue={filters.q}
              placeholder="Member name, invoice number, or action"
              className={input}
            />
          </label>
          <label className="flex w-full flex-col gap-1 sm:w-52">
            <span className="label-caps text-muted-foreground">Action</span>
            <select name="action" defaultValue={filters.action} className={input}>
              <option value="">All actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {activityLabel(action)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-full flex-col gap-1 sm:w-52">
            <span className="label-caps text-muted-foreground">Gym location</span>
            <select name="location" defaultValue={location} className={input}>
              <option value="">All locations</option>
              {location && !locationNames.has(location) && (
                <option value={location}>Unavailable location</option>
              )}
              {locations.map((gym) => (
                <option key={gym.id} value={gym.id}>
                  {gym.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:outline-primary rounded px-4 py-2.5 text-sm font-medium focus-visible:outline-2"
          >
            Search
          </button>
          {filtered && (
            <Link href="/admin/activity-log" className={button}>
              Clear filters
            </Link>
          )}
        </Form>
        <div className="my-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-[13px]" role="status">
            {result.total
              ? `Showing ${(result.page - 1) * ACTIVITY_PAGE_SIZE + 1}–${Math.min(result.page * ACTIVITY_PAGE_SIZE, result.total)} of ${result.total} activities`
              : "No activities"}
          </p>
          <span className="text-muted-foreground text-[13px]">
            Page {result.page} of {result.pageCount}
          </span>
        </div>
        {result.rows.length === 0 ? (
          <div className="border-border bg-card rounded border px-4 py-12 text-center">
            <History className="text-muted-foreground mx-auto size-7" aria-hidden="true" />
            <h2 className="mt-3 text-sm font-medium">
              {filtered ? "No matching activity" : "No activity recorded yet"}
            </h2>
            <p className="text-muted-foreground mt-1 text-[13px]">
              {filtered
                ? "Try another search or clear the filters."
                : "Recorded actions will appear here as they happen."}
            </p>
          </div>
        ) : (
          <div className="border-border bg-card overflow-x-auto rounded border">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <caption className="sr-only">
                Gym activity, newest first. Times in Asia/Karachi.
              </caption>
              <thead>
                <tr className="border-border bg-primary-tint border-b">
                  {["Date and time", "Location", "Performed by", "Action", "Record", "Details"].map(
                    (label) => (
                      <th
                        key={label}
                        scope="col"
                        className="label-caps text-muted-foreground px-4 py-3"
                      >
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id} className="border-border border-b last:border-0">
                    <td className="data-mono px-4 py-3 text-[13px] whitespace-nowrap">
                      <time dateTime={row.createdAt.toISOString()}>
                        {dateTime.format(row.createdAt)}
                      </time>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {locationNames.get(row.tenantId ?? "") ?? "Unavailable location"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p>{row.actor}</p>
                      <p className="text-muted-foreground mt-1 text-xs break-all">{row.actorId}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                      {activityLabel(row.action)}
                    </td>
                    <td className="data-mono max-w-64 px-4 py-3 text-[13px] break-words">
                      {row.record}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-sm">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result.pageCount > 1 && (
          <nav aria-label="Activity pages" className="mt-4 flex justify-end gap-2">
            {result.page > 1 ? (
              <Link href={href(result.page - 1)} className={button}>
                Previous
              </Link>
            ) : (
              <span aria-disabled="true" className={`${button} opacity-50`}>
                Previous
              </span>
            )}
            {result.page < result.pageCount ? (
              <Link href={href(result.page + 1)} className={button}>
                Next
              </Link>
            ) : (
              <span aria-disabled="true" className={`${button} opacity-50`}>
                Next
              </span>
            )}
          </nav>
        )}
      </main>
    </PlatformShell>
  );
}
