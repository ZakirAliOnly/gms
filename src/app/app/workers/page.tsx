import { CircleCheck, HardHat, MessageCircle, TrendingDown, Users, Wallet } from "lucide-react";
import { tenantDb } from "@/lib/tenant-db";
import { formatDate, formatMoney } from "@/lib/format";
import { monthLabel, monthOptions, parseMonth, toNum } from "@/lib/workers";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  AddWorkerButton,
  EntryDelete,
  MonthSelect,
  WorkerActions,
  WorkerRowShell,
  type WorkerView,
} from "./worker-dialogs";

export const metadata = { title: "Workers" };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** wa.me wants an international number: 03XXXXXXXXX -> 923XXXXXXXXX. */
function whatsappLink(phone: string, text: string) {
  const international = phone.startsWith("0") ? `92${phone.slice(1)}` : phone;
  return `https://wa.me/${international}?text=${encodeURIComponent(text)}`;
}

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = parseMonth(sp.month);
  const monthText = monthLabel(month);
  const { db, tenantId } = await tenantDb("workers");

  const [workers, advances, extraHours, payments, methods] = await Promise.all([
    db.worker.findMany({
      where: { tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    db.workerAdvance.findMany({
      where: { tenantId, month },
      orderBy: { paidAt: "asc" },
      select: {
        id: true,
        workerId: true,
        amount: true,
        note: true,
        paidAt: true,
        expense: { select: { paymentMethod: { select: { name: true } } } },
      },
    }),
    db.workerExtraHours.findMany({
      where: { tenantId, month },
      orderBy: { createdAt: "asc" },
      select: { id: true, workerId: true, hours: true, rate: true, amount: true, note: true },
    }),
    db.workerWagePayment.findMany({
      where: { tenantId, month },
      select: {
        id: true,
        workerId: true,
        netPaid: true,
        paidAt: true,
        expense: { select: { paymentMethod: { select: { name: true } } } },
      },
    }),
    db.paymentMethod.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const sum = (rows: { amount: { toString(): string } }[]) =>
    rows.reduce((total, row) => total + toNum(row.amount), 0);
  const activeWorkers = workers.filter((worker) => worker.isActive);
  const wageBill = activeWorkers.reduce((total, worker) => total + toNum(worker.monthlyWage), 0);
  const advancesTotal = sum(advances);
  const wagesPaid = payments.reduce((total, payment) => total + toNum(payment.netPaid), 0);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="People"
        title="Workers"
        description="Manage employees, wages & advances."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <MonthSelect value={month} options={monthOptions(month)} />
            <AddWorkerButton />
          </div>
        }
      />

      <p className="border-border bg-primary-tint mt-6 rounded-lg border px-4 py-3 text-[13px] leading-5">
        <strong>Payroll month:</strong> {monthText}. Advances, extra hours and wage payments are
        stored per month. Pick another month above to work on a different period; each month has its
        own advances and paid/unpaid state.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active workers"
          value={String(activeWorkers.length)}
          icon={Users}
          tone="info"
        />
        <StatCard
          label="Monthly wage bill"
          value={formatMoney(wageBill)}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Advances this month"
          value={formatMoney(advancesTotal)}
          icon={TrendingDown}
          tone="danger"
        />
        <StatCard label="Wages paid" value={formatMoney(wagesPaid)} icon={CircleCheck} />
      </div>

      {workers.length === 0 ? (
        <div className="border-border bg-card mt-6 flex flex-col items-center justify-center rounded-lg border px-6 py-16 text-center">
          <HardHat className="text-muted-foreground/50 size-8" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">No workers found</p>
          <p className="text-muted-foreground mt-1 text-[13px] leading-[18px]">
            Add your first worker to start tracking wages and advances.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {workers.map((worker) => {
            const view: WorkerView = {
              id: worker.id,
              name: worker.name,
              role: worker.role,
              phone: worker.phone,
              monthlyWage: toNum(worker.monthlyWage),
              extraHoursRate: toNum(worker.extraHoursRate),
              isActive: worker.isActive,
            };
            const workerAdvances = advances.filter((a) => a.workerId === worker.id);
            const workerExtra = extraHours.filter((e) => e.workerId === worker.id);
            const payment = payments.find((p) => p.workerId === worker.id) ?? null;
            const advanceSum = sum(workerAdvances);
            const extraSum = sum(workerExtra);
            const net = payment ? toNum(payment.netPaid) : view.monthlyWage + extraSum - advanceSum;

            const stat = (label: string, value: string, tone?: string) => (
              <div className="min-w-24 text-right">
                <p className="label-caps text-muted-foreground">{label}</p>
                <p className={`data-mono text-sm font-semibold ${tone ?? ""}`}>{value}</p>
              </div>
            );

            return (
              <WorkerRowShell
                key={worker.id}
                header={
                  <>
                    <div className="flex min-w-56 flex-1 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                      >
                        {initials(worker.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          {worker.name}
                          {worker.role && (
                            <span className="bg-primary-tint text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                              {worker.role}
                            </span>
                          )}
                          {!worker.isActive && (
                            <span className="bg-secondary text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                              Inactive
                            </span>
                          )}
                        </p>
                        {worker.phone && (
                          <p className="data-mono text-muted-foreground text-xs">{worker.phone}</p>
                        )}
                      </div>
                    </div>
                    {stat("Monthly wage", formatMoney(view.monthlyWage))}
                    {stat("Advances", advanceSum ? formatMoney(advanceSum) : "—")}
                    {stat("Extra hrs", extraSum ? formatMoney(extraSum) : "—")}
                    {stat("Net payable", formatMoney(net), "text-success")}
                    <div className="flex flex-wrap items-center gap-2">
                      {payment && (
                        <span className="bg-success-tint text-success inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
                          <CircleCheck className="size-3.5" aria-hidden="true" />
                          Paid
                        </span>
                      )}
                      {payment && worker.phone && (
                        <a
                          href={whatsappLink(
                            worker.phone,
                            `Dear ${worker.name}, your ${monthText} wages of ${formatMoney(payment.netPaid)} were paid on ${formatDate(payment.paidAt)} via ${payment.expense.paymentMethod.name}.`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Send receipt on WhatsApp"
                          className="border-success text-success hover:bg-success-tint rounded border p-1.5"
                        >
                          <MessageCircle className="size-3.5" aria-hidden="true" />
                          <span className="sr-only">Send receipt on WhatsApp</span>
                        </a>
                      )}
                      <WorkerActions
                        worker={view}
                        month={month}
                        monthText={monthText}
                        methods={methods}
                        extra={extraSum}
                        advances={advanceSum}
                        paymentId={payment?.id ?? null}
                      />
                    </div>
                  </>
                }
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <section>
                    <h3 className="label-caps text-muted-foreground mb-2">
                      Advances — {monthText}
                    </h3>
                    {workerAdvances.length === 0 ? (
                      <p className="text-muted-foreground text-[13px]">No advances this month.</p>
                    ) : (
                      <ul className="divide-border divide-y text-sm">
                        {workerAdvances.map((advance) => (
                          <li key={advance.id} className="flex items-center gap-3 py-2">
                            <span className="data-mono text-muted-foreground w-24 shrink-0">
                              {formatDate(advance.paidAt)}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              {advance.expense.paymentMethod.name}
                              {advance.note ? ` · ${advance.note}` : ""}
                            </span>
                            <span className="data-mono font-medium">
                              {formatMoney(advance.amount.toString())}
                            </span>
                            <EntryDelete id={advance.id} kind="advance" locked={Boolean(payment)} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section>
                    <h3 className="label-caps text-muted-foreground mb-2">
                      Extra hours — {monthText}
                    </h3>
                    {workerExtra.length === 0 ? (
                      <p className="text-muted-foreground text-[13px]">
                        No extra hours this month.
                      </p>
                    ) : (
                      <ul className="divide-border divide-y text-sm">
                        {workerExtra.map((entry) => (
                          <li key={entry.id} className="flex items-center gap-3 py-2">
                            <span className="data-mono text-muted-foreground w-28 shrink-0">
                              {toNum(entry.hours)} h × {toNum(entry.rate)}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{entry.note ?? ""}</span>
                            <span className="data-mono font-medium">
                              {formatMoney(entry.amount.toString())}
                            </span>
                            <EntryDelete id={entry.id} kind="hours" locked={Boolean(payment)} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
                {payment && (
                  <p className="text-muted-foreground mt-4 text-[13px]">
                    Paid {formatMoney(payment.netPaid)} on {formatDate(payment.paidAt)} via{" "}
                    {payment.expense.paymentMethod.name}.
                  </p>
                )}
              </WorkerRowShell>
            );
          })}
        </ul>
      )}
    </main>
  );
}
