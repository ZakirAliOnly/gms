"use client";
import Link from "next/link";
import { createContext, useContext } from "react";
import type { ComponentProps } from "react";
import { useModuleAccess } from "./module-access-provider";
import { moduleFromPath } from "@/lib/module-access";
export const WorkspaceBase = createContext("/app");
export function WorkspaceProvider({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return <WorkspaceBase.Provider value={value}>{children}</WorkspaceBase.Provider>;
}
export function useWorkspaceBase() {
  return useContext(WorkspaceBase);
}
export default function WorkspaceLink({ href, ...props }: ComponentProps<typeof Link>) {
  const base = useWorkspaceBase();
  const access = useModuleAccess();
  const currentModule = typeof href === "string" ? moduleFromPath(href.split("?")[0]) : undefined;
  if (
    currentModule &&
    currentModule !== "settings" &&
    (currentModule === "users" ? !access.manager : !access.modules.includes(currentModule))
  )
    return (
      <span className={props.className} aria-disabled="true">
        {props.children}
      </span>
    );
  const scoped =
    typeof href === "string" && /^\/app(?:[/?#]|$)/.test(href) ? base + href.slice(4) : href;
  return <Link {...props} href={scoped} />;
}
