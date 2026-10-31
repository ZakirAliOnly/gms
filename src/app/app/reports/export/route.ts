import type { NextRequest } from "next/server";
import { tenantDb } from "@/lib/tenant-db";
import { buildReports } from "@/lib/reports";
import { csvCell, reportRange } from "@/lib/report-range";

export async function GET(request: NextRequest) {
  const { db, tenantId } = await tenantDb();
  const params = request.nextUrl.searchParams;
  let range;
  try {
    range = reportRange(params.get("from") ?? undefined, params.get("to") ?? undefined);
  } catch (error) {
    return new Response((error as Error).message, { status: 400 });
  }
  const sections = await buildReports(db, tenantId, range);
  const rows = sections.flatMap((s) => [
    [s.title],
    ...(s.note ? [[s.note]] : []),
    s.columns,
    ...s.rows,
    [],
  ]);
  return new Response("\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reports-${range.from}-${range.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
