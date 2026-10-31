"use client";

import { useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { AppFooter } from "./app-footer";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { Toaster } from "sonner";
import { AppearancePreferences } from "./display-preferences";

export function AppLayout({
  children,
  workspace,
  name,
  email,
  role,
  signOut,
}: {
  children: React.ReactNode;
  workspace: string;
  name: string;
  email: string;
  role: string;
  signOut: React.ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const sidebar = (onNavigate?: () => void) => (
    <AppSidebar workspace={workspace} role={role} signOut={signOut} onNavigate={onNavigate} />
  );
  return (
    <div className="app-layout" data-collapsed={collapsed} data-tablet-expanded={tabletExpanded}>
      <AppearancePreferences />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="app-sidebar" aria-label="Application sidebar">
        {sidebar()}
      </aside>
      <div className="app-workspace">
        <AppTopbar
          name={name}
          email={email}
          role={role}
          signOut={signOut}
          onToggle={() => {
            if (window.innerWidth < 768) setDrawer(true);
            else if (window.innerWidth < 1280) setTabletExpanded((value) => !value);
            else setCollapsed((value) => !value);
          }}
        />
        <div id="main-content" className="app-content" tabIndex={-1}>
          {children}
        </div>
        <AppFooter />
      </div>
      <Dialog open={drawer} onOpenChange={setDrawer}>
        <DialogContent className="mobile-sidebar" aria-describedby="navigation-description">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription id="navigation-description" className="sr-only">
            Navigate Golden GYM modules.
          </DialogDescription>
          {sidebar(() => setDrawer(false))}
        </DialogContent>
      </Dialog>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
