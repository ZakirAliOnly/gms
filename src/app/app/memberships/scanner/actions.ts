"use server";

import { tenantDb } from "@/lib/tenant-db";
import { memberScannerRecord } from "@/lib/member-scanner";
import { scannerPrintDocument } from "./scanner-print";

export async function getScannerPrintDocument(
  memberId: string
): Promise<{ html?: string; error?: string }> {
  const { db, tenantId, userName } = await tenantDb("memberships");
  if (typeof memberId !== "string" || !memberId.trim()) return { error: "Member not found." };
  const record = await db.$transaction(
    (tx) => memberScannerRecord(tx, tenantId, { memberId }, 1, true),
    { isolationLevel: "RepeatableRead" }
  );
  return record ? { html: scannerPrintDocument(record, userName) } : { error: "Member not found." };
}
