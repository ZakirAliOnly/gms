"use client";
import { createContext, useContext } from "react";
import { MODULES, type ModuleKey } from "@/lib/module-access";
const Access = createContext({
  modules: MODULES.map((item) => item.key) as string[],
  editable: MODULES.map((item) => item.key) as string[],
  manager: true,
});
export function ModuleAccessProvider({
  modules,
  editable,
  manager,
  children,
}: {
  modules: string[];
  editable: string[];
  manager: boolean;
  children: React.ReactNode;
}) {
  return <Access.Provider value={{ modules, editable, manager }}>{children}</Access.Provider>;
}
export function useModuleAccess() {
  return useContext(Access);
}
export function EditAccess({ module, children }: { module: ModuleKey; children: React.ReactNode }) {
  const access = useModuleAccess();
  return access.editable.includes(module) ? children : null;
}
export function ViewAccess({ module, children }: { module: ModuleKey; children: React.ReactNode }) {
  const access = useModuleAccess();
  return access.modules.includes(module) ? children : null;
}
