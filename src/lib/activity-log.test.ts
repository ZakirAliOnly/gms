import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  activityLabel,
  activitySummary,
  getActivityLog,
  parseActivityFilters,
  queryActivityLog,
} from "./activity-log";

test("admin queries support all gyms or a selected gym without exposing platform-only logs", async () => {
  const scopes: unknown[] = [];
  const db = {
    auditLog: {
      count: async ({ where }: { where: unknown }) => {
        scopes.push(where);
        return 0;
      },
      groupBy: async () => [],
      findMany: async () => [],
    },
    user: { findMany: async () => [] },
  } as unknown as Pick<PrismaClient, "auditLog" | "user">;
  const filters = { q: "", action: "", page: 1 };
  await queryActivityLog(db, { admin: true }, filters);
  await queryActivityLog(db, { admin: true, tenantId: "gym2" }, filters);
  assert.deepEqual(scopes, [{ tenantId: { not: null } }, { tenantId: "gym2" }]);
  await assert.rejects(queryActivityLog(db, { tenantId: "" }, filters), /Tenant scope required/);
  assert.equal(
    activitySummary("MEMBERSHIP_CREATE", "member1", {
      name: "Ali",
      number: "IR123456",
      amount: "500",
    }).record,
    "Ali · IR123456"
  );
  assert.equal(activityLabel("RETAIL_INVOICE_CREATE"), "Invoice created");
});

test("filters handle invalid and repeated query parameters", () => {
  assert.deepEqual(
    parseActivityFilters({ q: [" INV-001 ", "ignored"], page: "Infinity", tenantId: "other" }),
    { q: "INV-001", action: "", page: 1, range: "30" }
  );
  assert.equal(parseActivityFilters({ page: "-2" }).page, 1);
  assert.equal(parseActivityFilters({ page: "1.5" }).page, 1);
  assert.equal(parseActivityFilters({ page: "2" }).page, 2);
  assert.equal(parseActivityFilters({ q: "x".repeat(200) }).q.length, 120);
});

test("admin hides Superadmin activity in rows, totals, and action options even when searched", async () => {
  const queries: { where: Record<string, unknown>; distinct?: string[] }[] = [];
  const db = {
    user: {
      findMany: async (args: unknown) => {
        assert.deepEqual(args, { where: { role: "SUPERADMIN" }, select: { id: true } });
        return [{ id: "super1" }, { id: "super2" }];
      },
    },
    auditLog: {
      groupBy: async (args: { where: Record<string, unknown> }) => { queries.push(args); return []; },
      count: async (args: { where: Record<string, unknown> }) => {
        queries.push(args);
        return 0;
      },
      findMany: async (args: { where: Record<string, unknown>; distinct?: string[] }) => {
        queries.push(args);
        return [];
      },
    },
  } as unknown as Pick<PrismaClient, "auditLog" | "user">;
  for (const scope of [{ admin: true as const }, { admin: true as const, tenantId: "gym1" }]) {
    queries.length = 0;
    const result = await queryActivityLog(db, scope, {
      q: "super1",
      action: "tenant.create",
      page: 99,
    });
    assert.equal(queries.length, 3);
    for (const query of queries) {
      assert.deepEqual(query.where.actorId, { notIn: ["super1", "super2"] });
      assert.deepEqual(query.where.tenantId, scope.tenantId ?? { not: null });
    }
    assert.deepEqual(result.rows, []);
    assert.deepEqual(result.actions, []);
    assert.equal(result.total, 0);
    assert.equal(result.page, 1);
  }
});

test("summaries expose only intended fields and handle incomplete older records", () => {
  const summary = activitySummary("tenant.create", "Tenant:1", {
    name: "Gym",
    email: "private@example.com",
    password: "secret",
  });
  assert.equal(summary.record, "Gym");
  assert.ok(!JSON.stringify(summary).includes("secret"));
  assert.ok(!JSON.stringify(summary).includes("private@example.com"));
  assert.equal(activitySummary("RETAIL_INVOICE_EDIT", "invoice1", null).record, "invoice1");
  assert.equal(
    activitySummary("RETAIL_INVOICE_EDIT", "invoice1", { previousTotal: "not-money", total: "4" })
      .detail,
    "Invoice details updated."
  );
  assert.ok(
    activitySummary("RETAIL_INVOICE_EDIT", "invoice1", {
      number: "INV-0001",
      previousTotal: "0",
      total: "20.50",
    }).detail.includes("20.50")
  );
  assert.equal(activityLabel("RETAIL_INVOICE_DELETE"), "Invoice deleted");
  assert.equal(typeof activityLabel("constructor"), "string");
});

test("all log reads stay tenant-scoped, pages clamp, and actors are restricted", async () => {
  let actorScope: unknown;
  let recordQuery: unknown;
  const db = {
    auditLog: {
      groupBy: async ({ where }: { where: { tenantId: string } }) => { assert.equal(where.tenantId, "gym1"); return [{ action: "RETAIL_INVOICE_EDIT" }]; },
      count: async ({ where }: { where: { tenantId: string } }) => {
        assert.equal(where.tenantId, "gym1");
        return 26;
      },
      findMany: async (args: {
        where: { tenantId: string };
        distinct?: string[];
        skip?: number;
        take?: number;
      }) => {
        assert.equal(args.where.tenantId, "gym1");
        if (args.distinct) return [{ action: "RETAIL_INVOICE_EDIT" }];
        recordQuery = args;
        assert.equal(args.skip, 25);
        assert.equal(args.take, 25);
        return [
          {
            id: "log1",
            actorId: "user1",
            action: "RETAIL_INVOICE_EDIT",
            target: "invoice1",
            meta: { number: "INV-001", previousTotal: "10", total: "20" },
            createdAt: new Date("2026-09-30T10:00:00Z"),
          },
        ];
      },
    },
    user: {
      findMany: async (args: unknown) => {
        actorScope = args;
        return [{ id: "user1", name: "Gym operator", role: "TENANT" }];
      },
    },
  } as unknown as Pick<PrismaClient, "auditLog" | "user">;
  const result = await getActivityLog(db, "gym1", {
    q: "INV-001",
    action: "RETAIL_INVOICE_EDIT",
    page: 999999,
  });
  assert.equal(result.page, 2);
  assert.equal(result.rows[0].actor, "Gym operator");
  assert.equal(result.rows[0].record, "INV-001");
  assert.deepEqual(actorScope, {
    where: {
      id: { in: ["user1"] },
      OR: [{ tenantId: "gym1" }, { role: { in: ["SUPERADMIN", "ADMIN"] }, tenantId: null }],
    },
    select: { id: true, name: true, role: true },
  });
  assert.ok(JSON.stringify(recordQuery).includes('"path":["number"]'));
});
