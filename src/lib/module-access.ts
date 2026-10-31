export const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "memberships", label: "Memberships & receipts" },
  { key: "inventory", label: "Inventory" },
  { key: "invoices", label: "Invoices" },
  { key: "suppliers", label: "Suppliers & purchases" },
  { key: "expenses", label: "Expenses" },
  { key: "payment-methods", label: "Payment methods" },
  { key: "data", label: "Data viewer & exports" },
  { key: "reports", label: "Reports & exports" },
  { key: "activity-log", label: "Activity log" },
] as const;
export type ModuleKey = (typeof MODULES)[number]["key"];
export type AccessUser = {
  role: string;
  isBranchManager: boolean;
  moduleAccess: string[];
  editableModules: string[];
};
export const MODULE_HEADER = "x-gym-module";
export function moduleFromPath(path: string): ModuleKey | "users" | "settings" | undefined {
  const route = path.replace(/^\/admin\/branches\/[^/]+/, "/app");
  if (!/^\/app(?:\/|$)/.test(route)) return undefined;
  const key = route.split("/")[2] || "dashboard";
  return key === "users" || key === "settings" || MODULES.some((module) => module.key === key)
    ? (key as ModuleKey | "users" | "settings")
    : undefined;
}
export function canAccess(
  user: AccessUser,
  module: ModuleKey | "users" | "settings",
  mode: "view" | "edit" = "view"
) {
  if (
    user.role === "ADMIN" ||
    user.role === "SUPERADMIN" ||
    (user.role === "TENANT" && user.isBranchManager)
  )
    return true;
  if (user.role !== "TENANT") return false;
  if (module === "settings") return mode === "view";
  if (module === "users") return false;
  return (
    user.moduleAccess.includes(module) && (mode === "view" || user.editableModules.includes(module))
  );
}
export function firstAccessiblePath(user: AccessUser) {
  const firstModule = MODULES.find((module) => canAccess(user, module.key));
  return firstModule
    ? firstModule.key === "dashboard"
      ? "/app"
      : `/app/${firstModule.key}`
    : "/app/settings";
}
