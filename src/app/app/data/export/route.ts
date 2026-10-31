import { csvCell } from "@/lib/report-range";
import type { NextRequest } from "next/server";
import { SOFTWARE_FOOTER } from "@/lib/branding";
import { formatDate, formatMoneyPrecise } from "@/lib/format";
import { DATASET_META, getDataset, parseDataset, type Column, type DataRow } from "../data-sources";

/**
 * CSV export for the current view (FR-50).
 *
 * A route handler rather than a client-side blob so the file is generated from
 * the same tenant-scoped queries the table uses - the export can never contain
 * rows the viewer could not already see.
 */

function render(row: DataRow, column: Column): string {
  const value = row[column.key];
  if (value === null || value === undefined || value === "") return "";

  if (column.type === "date") return formatDate(new Date(String(value)));
  if (column.type === "money") return formatMoneyPrecise(Number(value));
  return String(value);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const dataset = parseDataset(params.get("dataset") ?? undefined);
  const meta = DATASET_META[dataset];

  const { rows } = await getDataset({
    dataset,
    search: params.get("q") ?? "",
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    page: 1,
    all: true,
  });

  const header = meta.columns.map((c) => csvCell(c.label)).join(",");
  const body = rows.map((row) => meta.columns.map((c) => csvCell(render(row, c))).join(","));

  // BOM so Excel opens UTF-8 correctly - without it "Rs" and names with
  // non-ASCII characters arrive mangled.
  const footer = meta.columns
    .map((_, index) => csvCell(index === 0 ? SOFTWARE_FOOTER : ""))
    .join(",");
  const csv = `﻿${[header, ...body, footer].join("\r\n")}\r\n`;
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dataset}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
