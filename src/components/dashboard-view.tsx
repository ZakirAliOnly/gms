import Link from "@/components/workspace-link";
import {
  AlertTriangle,
  BadgeDollarSign,
  Boxes,
  CalendarDays,
  CalendarClock,
  Plus,
  Receipt,
  ScanLine,
  TrendingUp,
  Users,
  Wallet,
  ArrowRight,
  ChartNoAxesCombined,
} from "lucide-react";
import type { DashboardStats } from "@/app/app/dashboard-data";
import { formatMoney, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "./status-badge";
import { RevenueChart } from "./revenue-chart";

const QUICK_ACTIONS = [
  { href: "/app/memberships?action=add", label: "Add membership", icon: Plus },
  { href: "/app/invoices", label: "New sale", icon: Receipt },
  { href: "/app/expenses?action=add", label: "Record expense", icon: BadgeDollarSign },
  { href: "/app/memberships?scan=1", label: "Scan barcode", icon: ScanLine },
];

export function DashboardView({
  tenantName,
  tenantLocation,
  userName,
  stats,
  quickActions,
  children,
  admin = false,
}: {
  tenantName: string;
  tenantLocation: string;
  userName?: string;
  stats: DashboardStats;
  quickActions?: React.ReactNode;
  children?: React.ReactNode;
  admin?: boolean;
}) {
  const net = stats.revenueThisMonth - stats.expensesThisMonth;
  return (
    <main className="dashboard-page">
      <PageHeader
        title={userName ? `Welcome back, ${userName.split(" ")[0]}!` : "Welcome back!"}
        description={`Here's what's happening at ${tenantName} today.`}
        action={
          <time className="dashboard-date" dateTime={new Date().toISOString()}>
            <CalendarDays className="size-5" aria-hidden="true" />
            {new Intl.DateTimeFormat("en-PK", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Asia/Karachi",
            }).format(new Date())}
          </time>
        }
      />
      <p className="sr-only">{tenantLocation}</p>
      <section className="dashboard-kpis" aria-label="Key figures">
        <StatCard
          label="Active members"
          value={stats.activeMembers.toLocaleString("en-PK")}
          icon={Users}
          href="/app/memberships"
          hint="Current memberships"
        />
        <StatCard
          label="Renewals due this week"
          value={stats.renewalsDueThisWeek.toLocaleString("en-PK")}
          icon={CalendarClock}
          href="/app/memberships?tab=renewals"
          hint="Due in the next 7 days"
          tone="success"
        />
        <StatCard
          label="Overdue renewals"
          value={stats.renewalsOverdue.toLocaleString("en-PK")}
          icon={AlertTriangle}
          href="/app/memberships?tab=overdue"
          hint={stats.renewalsOverdue ? "Needs attention" : "No overdue renewals"}
          tone="danger"
          emphasis={stats.renewalsOverdue > 0}
        />
        <StatCard
          label="Low stock items"
          value={stats.lowStockCount.toLocaleString("en-PK")}
          icon={Boxes}
          href="/app/inventory?low=1"
          hint={stats.lowStockCount ? "At or below reorder level" : "All items above reorder level"}
          tone="info"
        />
      </section>
      <div className="dashboard-actions action-toolbar">
        {quickActions ??
          QUICK_ACTIONS.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className={`dashboard-action ${index === 0 ? "is-primary" : ""}`}
              >
                <Icon aria-hidden="true" className="size-5" />
                {action.label}
              </Link>
            );
          })}
      </div>
      <div className="dashboard-columns">
        <section className="panel revenue-panel" aria-label="Revenue overview">
          <div className="panel-heading">
            <div className="flex items-start gap-3">
              <ChartNoAxesCombined className="text-primary mt-1 size-6" aria-hidden="true" />
              <div>
                <h2>Revenue overview</h2>
                <p>Memberships and retail sales</p>
              </div>
            </div>
          </div>
          <div className="revenue-summary">
            <StatCard
              label="Revenue today"
              value={formatMoney(stats.revenueToday)}
              icon={Wallet}
              tone="info"
              hint="Memberships and retail"
            />
            <StatCard
              label="Revenue this month"
              value={formatMoney(stats.revenueThisMonth)}
              icon={TrendingUp}
              href={admin ? "/admin/reports" : "/app/reports"}
              hint="Memberships and retail"
            />
            <StatCard
              label="Expenses this month"
              value={formatMoney(stats.expensesThisMonth)}
              icon={Receipt}
              tone="danger"
              hint="Recorded operating costs"
            />
          </div>
          <RevenueChart series={stats.series} />
        </section>
        <div className="dashboard-side-panels">
          <section className="panel month-summary">
            <div className="panel-heading">
              <h2>This month summary</h2>
            </div>
            <dl>
              <SummaryRow
                icon={Users}
                label="Membership renewals"
                value={formatMoney(stats.membershipRevenueThisMonth)}
              />
              <SummaryRow
                icon={Boxes}
                label="Retail sales"
                value={formatMoney(stats.retailRevenueThisMonth)}
              />
              <SummaryRow
                icon={Receipt}
                label="Expenses"
                value={`− ${formatMoney(stats.expensesThisMonth)}`}
                negative
              />
              <SummaryRow icon={Wallet} label="Net" value={formatMoney(net)} negative={net < 0} />
            </dl>
            <p className="summary-note">Net excludes stock costs and supplier payments.</p>
          </section>
          <section className="panel recent-members">
            <div className="panel-heading">
              <h2>Recent members</h2>
              <Link href="/app/memberships" className="text-primary text-xs font-medium">
                View all
              </Link>
            </div>
            <div className="recent-members-list">
              {stats.recentMembers.length ? (
                stats.recentMembers.map((member) => (
                  <div key={member.id} className="recent-member">
                    <span className="member-avatar">
                      {member.name
                        .split(" ")
                        .slice(0, 2)
                        .map((word) => word[0])
                        .join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{member.name}</p>
                      <p className="text-muted-foreground text-xs">{member.barcode}</p>
                    </div>
                    <StatusBadge tone={member.active ? "success" : "warning"}>
                      {member.status}
                    </StatusBadge>
                    <div className="recent-member-package">
                      <p>{member.package}</p>
                      <small>{formatMoney(member.price)}</small>
                    </div>
                    <div className="recent-member-renewal">
                      <p>Next renewal</p>
                      <small>
                        {member.nextRenewal ? formatDate(new Date(member.nextRenewal)) : "—"}
                      </small>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <Users aria-hidden="true" />
                  <p>No members yet</p>
                  <small>New members will appear here.</small>
                </div>
              )}
            </div>
            <Link className="dashboard-action is-primary view-members" href="/app/memberships">
              View all members
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>
      {children}
    </main>
  );
}
function SummaryRow({
  icon: Icon,
  label,
  value,
  negative,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="summary-row">
      <dt>
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </dt>
      <dd className={negative ? "text-destructive" : ""}>{value}</dd>
    </div>
  );
}
