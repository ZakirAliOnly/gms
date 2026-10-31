"use client";

import Link, { useWorkspaceBase } from "@/components/workspace-link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dumbbell, Menu, X, ScrollText } from "lucide-react";
import { TENANT_NAV, isActiveNav } from "@/lib/nav";

export function TenantNav({
  tenantName,
  userEmail,
  signOut,
  admin = false,
}: {
  admin?: boolean;
  tenantName: string;
  userEmail: string;
  /** Rendered by the layout: sign-out is a server action. */
  signOut: React.ReactNode;
}) {
  const base = useWorkspaceBase();
  const pathname = "/app" + usePathname().slice(base.length);
  const items = admin
    ? [...TENANT_NAV, { href: "/app/activity-log", label: "Activity Log", icon: ScrollText }]
    : TENANT_NAV;
  const [open, setOpen] = useState(false);

  return (
    <header className="border-border bg-card sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-20 w-full max-w-[1440px] items-center gap-4 px-4 md:px-8">
        <Link href="/app" aria-label="Golden GYM home" className="text-primary flex shrink-0 items-center gap-2">
          <Dumbbell className="size-9" aria-hidden="true" />
          <span className="text-sm font-semibold">Golden GYM</span>
        </Link>

        {/*
          Scrolls horizontally rather than colliding with the sign-out button.
          Nine items plus icons do not fit at every desktop width, and letting
          them overlap is worse than letting them scroll.
        */}
        <nav
          className="hidden min-w-0 flex-1 [scrollbar-width:none] items-center overflow-x-auto xl:flex [&::-webkit-scrollbar]:hidden"
          aria-label="Main"
        >
          {items.map((item) => {
            const active = isActiveNav(item.href, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded px-2 py-2 text-[13px] font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-primary/5 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon
                  className={`size-4 shrink-0 ${active ? "" : "text-muted-foreground/70"}`}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/*
          The tenant name and email are not repeated here: the name already
          heads every page, and crowding them in forces the last nav item to
          clip. They stay in the mobile drawer, where there is room.
        */}
        <div className="ml-auto flex shrink-0 items-center gap-3 pl-2">
          <div className="hidden xl:block">{signOut}</div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="tenant-mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border p-2 transition-colors xl:hidden"
          >
            {open ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="tenant-mobile-nav"
          aria-label="Main"
          className="border-border max-h-[calc(100svh-5rem)] overflow-y-auto border-t xl:hidden"
        >
          <ul className="mx-auto w-full max-w-[1440px] px-4 py-2 md:px-8">
            {items.map((item) => {
              const active = isActiveNav(item.href, pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 border-l-4 py-3 pl-3 text-sm transition-colors ${
                      active
                        ? "border-primary text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground border-transparent"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="border-border mx-auto w-full max-w-[1440px] border-t px-4 py-4 md:px-8">
            <p className="truncate text-[13px] font-medium">{tenantName}</p>
            <p className="text-muted-foreground mb-3 truncate text-[12px]">{userEmail}</p>
            {signOut}
          </div>
        </nav>
      )}
    </header>
  );
}
