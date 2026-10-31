"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";
import type { RevenuePoint } from "@/lib/dashboard-insights";

export function RevenueChart({ series }: { series: RevenuePoint[] }) {
  const [range, setRange] = useState("month");
  const [selected, setSelected] = useState<number | null>(null);
  const currentMonth = series.at(-1)?.date.slice(0, 7);
  const points =
    range === "month"
      ? series.filter((point) => point.date.startsWith(currentMonth ?? ""))
      : series.slice(range === "week" ? -7 : -30);
  const max = Math.max(
    100,
    ...points.flatMap((point) => [point.membership, point.retail, point.expenses])
  );
  const ceiling = Math.ceil(max / 100) * 100;
  const x = (i: number) => (points.length < 2 ? 500 : (i * 1000) / (points.length - 1));
  const y = (value: number) => 200 - (value * 180) / ceiling;
  const line = (key: "membership" | "retail" | "expenses") =>
    points.map((point, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(point[key])}`).join(" ");
  const current = selected === null ? null : points[Math.min(selected, points.length - 1)];
  const labels = [
    ...new Set([
      0,
      Math.floor(points.length / 4),
      Math.floor(points.length / 2),
      Math.floor((points.length * 3) / 4),
      points.length - 1,
    ]),
  ];
  return (
    <div className="revenue-chart">
      <div className="chart-controls">
        <label className="sr-only" htmlFor="revenue-period">
          Revenue chart period
        </label>
        <CalendarDays aria-hidden="true" className="size-4" />
        <select
          id="revenue-period"
          value={range}
          onChange={(event) => {
            setRange(event.target.value);
            setSelected(null);
          }}
        >
          <option value="month">This month</option>
          <option value="week">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
      </div>
      <div
        className="chart-plot"
        role="group"
        aria-label="Revenue and expenses chart. Use left and right arrow keys to inspect days."
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            setSelected(
              Math.max(
                0,
                Math.min(points.length - 1, (selected ?? 0) + (event.key === "ArrowRight" ? 1 : -1))
              )
            );
          }
        }}
      >
        <div className="chart-y-labels" aria-hidden="true">
          {[ceiling, ceiling * 0.75, ceiling * 0.5, ceiling * 0.25, 0].map((value) => (
            <span key={value}>{value.toLocaleString("en-PK", { maximumFractionDigits: 0 })}</span>
          ))}
        </div>
        <svg
          viewBox="0 0 1000 210"
          preserveAspectRatio="none"
          aria-hidden="true"
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setSelected(
              Math.round(((event.clientX - rect.left) / rect.width) * (points.length - 1))
            );
          }}
        >
          <defs>
            <linearGradient id="revenue-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity=".22" />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity=".02" />
            </linearGradient>
          </defs>
          {[20, 65, 110, 155, 200].map((value) => (
            <line
              key={value}
              x1="0"
              x2="1000"
              y1={value}
              y2={value}
              stroke="var(--chart-grid)"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {labels.map((index) => (
            <line
              key={index}
              x1={x(index)}
              x2={x(index)}
              y1="20"
              y2="200"
              stroke="var(--chart-grid)"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {points.length > 0 && (
            <path d={`${line("membership")} L1000,200 L0,200 Z`} fill="url(#revenue-area)" />
          )}
          {(["membership", "retail", "expenses"] as const).map((key, index) => (
            <path
              key={key}
              d={line(key)}
              fill="none"
              stroke={`var(--chart-${index === 2 ? 4 : index + 1})`}
              strokeWidth="2.5"
              strokeDasharray={key === "expenses" ? "5 5" : undefined}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          ))}
          {current && selected !== null && (
            <line
              x1={x(Math.min(selected, points.length - 1))}
              x2={x(Math.min(selected, points.length - 1))}
              y1="20"
              y2="200"
              stroke="var(--primary)"
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <div className="chart-x-labels" aria-hidden="true">
          {labels.map((index) => (
            <span key={index}>
              {points[index]
                ? new Intl.DateTimeFormat("en-PK", {
                    day: "numeric",
                    month: "short",
                    timeZone: "Asia/Karachi",
                  }).format(new Date(`${points[index].date}T12:00:00+05:00`))
                : ""}
            </span>
          ))}
        </div>
      </div>
      <div className="chart-legend">
        <span>
          <i />
          Membership revenue
        </span>
        <span>
          <i />
          Retail sales
        </span>
        <span>
          <i />
          Expenses
        </span>
      </div>
      <p className="chart-detail" aria-live="polite">
        {current
          ? `${formatDate(new Date(`${current.date}T12:00:00+05:00`))}: memberships ${formatMoney(current.membership)}, retail ${formatMoney(current.retail)}, expenses ${formatMoney(current.expenses)}.`
          : "Tap the chart or use arrow keys to inspect daily totals."}
      </p>
    </div>
  );
}
