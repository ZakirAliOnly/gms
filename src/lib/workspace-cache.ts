import { revalidatePath as invalidate } from "next/cache";
/** Shared tenant modules also render under Admin branch routes; invalidate both trees. */
export function revalidatePath(path: string, type?: "layout" | "page") {
  invalidate(path, type);
  invalidate("/admin", "layout");
}
