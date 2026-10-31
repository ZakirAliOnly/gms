"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Menu, Bell, ChevronDown, UserRound } from "lucide-react";
import Link, { useWorkspaceBase } from "./workspace-link";
import { useModuleAccess } from "./module-access-provider";

export function AppTopbar({
  name,
  email,
  role,
  onToggle,
  signOut,
}: {
  name: string;
  email: string;
  role: string;
  onToggle: () => void;
  signOut: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const access = useModuleAccess();
  const router = useRouter();
  const base = useWorkspaceBase();
  const platform = role === "Superadmin";
  const initials = name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <header className="app-topbar">
      <button
        type="button"
        className="icon-control navigation-toggle"
        onClick={onToggle}
        aria-label="Toggle navigation"
      >
        <Menu aria-hidden="true" />
      </button>
      {platform || access.modules.includes("memberships") ? (
        <form
          role="search"
          className="global-search"
          onSubmit={(event) => {
            event.preventDefault();
            const query = new URLSearchParams({
              q: search.trim(),
              ...(platform ? {} : { scan: "1" }),
            });
            router.push(platform ? `/superadmin?${query}` : `${base}/memberships?${query}`);
          }}
        >
          <button type="submit" className="icon-control" aria-label="Search">
            <Search aria-hidden="true" />
          </button>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={platform ? "Search branches" : "Search members, barcode, or phone"}
            placeholder={platform ? "Search branches…" : "Search members, barcode, or phone…"}
          />
        </form>
      ) : (
        <span className="text-muted-foreground text-sm">Golden GYM workspace</span>
      )}
      <div className="topbar-actions">
        {!platform &&
          (access.modules.includes("memberships") || access.modules.includes("inventory")) && (
            <details className="topbar-dropdown">
              <summary className="icon-control" aria-label="Notifications">
                <Bell aria-hidden="true" />
              </summary>
              <div className="topbar-popover">
                <h2 className="font-semibold">Your attention, where it matters</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Check current renewals and inventory alerts.
                </p>
                {access.modules.includes("memberships") && (
                  <Link href="/app/memberships?tab=overdue">Overdue memberships</Link>
                )}
                {access.modules.includes("inventory") && (
                  <Link href="/app/inventory?low=1">Low-stock products</Link>
                )}
              </div>
            </details>
          )}
        <details className="topbar-dropdown profile-menu">
          <summary className="profile-control">
            <span className="user-avatar">{initials || <UserRound aria-hidden="true" />}</span>
            <span className="profile-description">
              <strong>{name}</strong>
              <small>
                {role === "Tenant" ? "Branch manager" : role === "Admin" ? "Supervisor" : role}
              </small>
            </span>
            <ChevronDown className="size-4" aria-hidden="true" />
            <span className="sr-only">Account menu</span>
          </summary>
          <div className="topbar-popover">
            <p className="text-muted-foreground text-sm break-all">{email}</p>
            <Link href={platform ? "/superadmin/settings" : "/app/settings"}>
              Account & settings
            </Link>
            {signOut}
          </div>
        </details>
      </div>
    </header>
  );
}
