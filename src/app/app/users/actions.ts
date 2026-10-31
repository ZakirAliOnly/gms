"use server";
import { tenantDb } from "@/lib/tenant-db";
import { saveBranchUser, branchUserSchema } from "@/lib/branch-users";
import { BusinessError } from "@/lib/transaction";
import { revalidatePath } from "@/lib/workspace-cache";
export type UserState = { ok?: boolean; error?: string };
export async function saveUser(_previous: UserState, form: FormData): Promise<UserState> {
  const { db, tenantId, userId } = await tenantDb("users", "edit");
  const parsed = branchUserSchema.safeParse({
    id: form.get("id") || undefined,
    name: form.get("name"),
    email: form.get("email"),
    password: form.get("password") || undefined,
    status: form.get("status"),
    moduleAccess: form.getAll("moduleAccess"),
    editableModules: form.getAll("editableModules"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check user details." };
  try {
    await saveBranchUser(db, tenantId, userId, parsed.data);
  } catch (error) {
    if (error instanceof BusinessError) return { error: error.message };
    throw error;
  }
  revalidatePath("/app/users");
  revalidatePath("/app/activity-log");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}
