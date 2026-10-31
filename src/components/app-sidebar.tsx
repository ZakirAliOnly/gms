"use client";

import { GymLogo } from "./gym-logo";
import { GYM_NAME } from "@/lib/branding";

import { usePathname } from "next/navigation";
import { Settings, UserCog, Building2 } from "lucide-react";
import { useModuleAccess } from "./module-access-provider";
import Link, { useWorkspaceBase } from "./workspace-link";
import { TENANT_NAV, isActiveNav } from "@/lib/nav";

export function AppSidebar({
  workspace,
  role,
  signOut,
  onNavigate,
}: {
  workspace: string;
  role: string;
  signOut: React.ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const base = useWorkspaceBase();
  const canonical = pathname.startsWith(base) ? "/app" + pathname.slice(base.length) : pathname;
  const platform = role === "Superadmin";
  const access = useModuleAccess();
  const items = platform
    ? [{ href: "/superadmin", label: "Branches", icon: Building2 }]
    : [
        ...TENANT_NAV.filter((item) =>
          access.modules.includes(item.href.split("/")[2] || "dashboard")
        ),
        ...(access.manager
          ? [{ href: "/app/users", label: "User Management", icon: UserCog }]
          : []),
      ];
  const settings = platform ? "/superadmin/settings" : "/app/settings";
  return (
    <>
      <Link
        href={platform ? "/superadmin" : (items[0]?.href ?? "/app/settings")}
        className="app-brand"
        onClick={onNavigate}
        aria-label={`${GYM_NAME} home`}
      >
        <span className="app-brand-icon">
          <GymLogo size={48} />
        </span>
        <span className="sidebar-label">
          <strong>{GYM_NAME}</strong>
          <small>{workspace}</small>
        </span>
      </Link>
      <nav className="sidebar-menu" aria-label="Main navigation">
        {items.map((item) => {
          const active = item.href.startsWith("/app")
            ? isActiveNav(item.href, canonical)
            : pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={`sidebar-link ${active ? "is-active" : ""}`}
            >
              <Icon aria-hidden="true" />
              <span className="sidebar-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <Link
          href={settings}
          title="Settings"
          onClick={onNavigate}
          aria-current={canonical === "/app/settings" ? "page" : undefined}
          className={`sidebar-link ${canonical === "/app/settings" ? "is-active" : ""}`}
        >
          <Settings aria-hidden="true" />
          <span className="sidebar-label">Settings</span>
        </Link>
        <div className="sidebar-signout">{signOut}</div>
        <p className="sidebar-label sidebar-caption">GYM MANAGEMENT SUITE</p>
      </div>
    </>
  );
}
