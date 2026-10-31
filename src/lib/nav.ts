import {
  BadgeDollarSign,
  Boxes,
  CreditCard,
  LayoutDashboard,
  Receipt,
  Table2,
  Truck,
  Users,
  ChartNoAxesCombined,
  ScrollText,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

/**
 * The tenant portal's modules, in the order they appear in the top bar.
 * Mirrors requirements.md section 3.3.
 */
export const TENANT_NAV: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/memberships", label: "Memberships", icon: Users },
  { href: "/app/inventory", label: "Inventory", icon: Boxes },
  { href: "/app/invoices", label: "Invoices", icon: Receipt },
  { href: "/app/suppliers", label: "Suppliers", icon: Truck },
  { href: "/app/expenses", label: "Expenses", icon: BadgeDollarSign },
  { href: "/app/payment-methods", label: "Payment Methods", icon: CreditCard },
  { href: "/app/data", label: "Data Viewer", icon: Table2 },
  { href: "/app/reports", label: "Reports", icon: ChartNoAxesCombined },
  { href: "/app/activity-log", label: "Activity Log", icon: ScrollText },
];

/**
 * True when `href` is the section the current path belongs to. "/app" matches
 * only exactly, so the dashboard is not marked active on every child route.
 */
export function isActiveNav(href: string, pathname: string): boolean {
  if (href === "/app") {
    return pathname === "/app";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
