import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/guards";
import { db } from "@/lib/db";
import { canAccess } from "@/lib/module-access";
import { UPLOAD_ROOT } from "@/lib/member-photo";

/**
 * Serves files from the uploads directory.
 *
 * Behind auth: member photos are not public. The path is normalized and
 * checked to stay inside UPLOAD_ROOT, so "../" cannot escape it.
 */

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const user = await requireRole("TENANT", "ADMIN", "SUPERADMIN");

  const { path: segments } = await params;
  const rel = segments.join("/");
  if (user.role === "TENANT" && !user.tenantId) return new Response("Not found", { status: 404 });
  const scope =
    user.role === "TENANT"
      ? { tenantId: user.tenantId!, tenant: { status: "ACTIVE" as const } }
      : {};
  const photoUrl = `/uploads/${rel}`;
  const [member, product] = await Promise.all([
    canAccess(user, "memberships")
      ? db.member.findFirst({ where: { ...scope, photoUrl }, select: { id: true } })
      : null,
    canAccess(user, "inventory") || canAccess(user, "invoices")
      ? db.product.findFirst({ where: { ...scope, photoUrl }, select: { id: true } })
      : null,
  ]);
  if (!member && !product) return new Response("Not found", { status: 404 });
  const resolved = path.resolve(UPLOAD_ROOT, rel);

  // Stay inside the uploads directory.
  if (resolved !== UPLOAD_ROOT && !resolved.startsWith(UPLOAD_ROOT + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME[ext];
  if (!contentType) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const file = await readFile(resolved);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
