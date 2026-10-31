import bcrypt from "bcryptjs";
import { z } from "zod";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { MODULES } from "./module-access";
import { serialTransaction, BusinessError } from "./transaction";
import { writeActivity } from "./activity-write";

const keys = MODULES.map((item) => item.key);
const moduleList = z
  .array(z.enum(keys))
  .max(keys.length)
  .transform((values) => [...new Set(values)]);
export const branchUserSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().toLowerCase(),
    password: z.string().optional(),
    status: z.enum(["ACTIVE", "DISABLED"]),
    moduleAccess: moduleList,
    editableModules: moduleList,
  })
  .superRefine((input, ctx) => {
    if (!input.id && !input.password)
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "A password is required for a new user.",
      });
    if (
      input.password &&
      (input.password.length < 12 || new TextEncoder().encode(input.password).length > 72)
    )
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Use at least 12 characters and at most 72 UTF-8 bytes.",
      });
    if (input.editableModules.some((key) => !input.moduleAccess.includes(key)))
      ctx.addIssue({
        code: "custom",
        path: ["editableModules"],
        message: "Edit permission also requires View permission.",
      });
    if (!input.moduleAccess.length)
      ctx.addIssue({
        code: "custom",
        path: ["moduleAccess"],
        message: "Select at least one module.",
      });
  });
export async function assertBranchManager(
  tx: Prisma.TransactionClient,
  tenantId: string,
  actorId: string
) {
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  const branch = await tx.tenant.findFirst({ where: { id: tenantId, status: "ACTIVE" } });
  if (
    !branch ||
    !actor ||
    actor.status !== "ACTIVE" ||
    !(
      actor.role === "ADMIN" ||
      (actor.role === "TENANT" && actor.tenantId === tenantId && actor.isBranchManager)
    )
  )
    throw new BusinessError(
      "Only the branch manager or Supervisor can manage this branch's users."
    );
}
export async function saveBranchUser(
  db: PrismaClient,
  tenantId: string,
  actorId: string,
  raw: unknown
) {
  const input = branchUserSchema.parse(raw);
  const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : undefined;
  return serialTransaction(db, async (tx) => {
    await assertBranchManager(tx, tenantId, actorId);
    if (input.id) {
      const target = await tx.user.findFirst({
        where: { id: input.id, tenantId, role: "TENANT", isBranchManager: false },
      });
      if (!target || target.id === actorId)
        throw new BusinessError("This account cannot be changed here.");
    }
    const duplicate = await tx.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (duplicate && duplicate.id !== input.id)
      throw new BusinessError("That email is already in use. Choose another email.");
    const current = input.id
      ? await tx.user.findUnique({ where: { id: input.id }, select: { status: true } })
      : null;
    const data = {
      name: input.name,
      email: input.email,
      status: input.status,
      ...(input.id && (passwordHash || current?.status !== input.status)
        ? { sessionVersion: { increment: 1 } }
        : {}),
      moduleAccess: input.moduleAccess,
      editableModules: input.editableModules,
      ...(passwordHash ? { passwordHash } : {}),
    };
    const user = input.id
      ? await tx.user.update({ where: { id: input.id, tenantId }, data })
      : await tx.user.create({
          data: {
            ...data,
            sessionVersion: 0,
            passwordHash: passwordHash!,
            tenantId,
            role: "TENANT",
            isBranchManager: false,
          },
        });
    await writeActivity(tx, {
      tenantId,
      actorId,
      action: input.id ? "BRANCH_USER_UPDATE" : "BRANCH_USER_CREATE",
      target: user.id,
      meta: {
        name: user.name,
        status: user.status,
        modules: input.moduleAccess,
        editableModules: input.editableModules,
        passwordChanged: !!passwordHash,
      },
    });
    return { id: user.id };
  });
}
