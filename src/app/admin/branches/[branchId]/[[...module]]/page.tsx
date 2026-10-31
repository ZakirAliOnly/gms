import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BranchActivity from "@/app/app/activity-log/page";
import UsersPage from "@/app/app/users/page";
import Dashboard from "@/app/app/page";
import Memberships from "@/app/app/memberships/page";
import Inventory from "@/app/app/inventory/page";
import StockHistory from "@/app/app/inventory/[id]/page";
import Invoices from "@/app/app/invoices/page";
import Suppliers from "@/app/app/suppliers/page";
import PurchaseReceipt from "@/app/app/suppliers/purchases/[id]/page";
import Expenses from "@/app/app/expenses/page";
import PaymentMethods from "@/app/app/payment-methods/page";
import Reports from "@/app/app/reports/page";
import Data from "@/app/app/data/page";
import Settings from "@/app/app/settings/page";

type Props = {
  params: Promise<{ branchId: string; module?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const titles: Record<string, string> = {
  memberships: "Memberships",
  inventory: "Inventory",
  invoices: "Invoices",
  suppliers: "Suppliers",
  expenses: "Expenses",
  "payment-methods": "Payment Methods",
  reports: "Reports",
  data: "Data Viewer",
  settings: "Settings",
  users: "User Management",
  "activity-log": "Activity Log",
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { module = [] } = await params;
  return { title: titles[module[0]] ?? "Dashboard" };
}

/** Real routes preserve Proxy's verified scope without an HTTP rewrite/re-entry. */
export default async function BranchPage({ params, searchParams }: Props) {
  const { module = [] } = await params;
  const raw = await searchParams;
  const query = Promise.resolve(
    Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
    )
  );
  if (!module.length) return <Dashboard />;
  if (module[0] === "inventory" && module.length === 2)
    return <StockHistory params={Promise.resolve({ id: module[1] })} />;
  if (module[0] === "suppliers" && module[1] === "purchases" && module.length === 3)
    return <PurchaseReceipt params={Promise.resolve({ id: module[2] })} />;
  if (module.length !== 1) notFound();
  switch (module[0]) {
    case "memberships":
      return <Memberships searchParams={query} />;
    case "inventory":
      return <Inventory searchParams={query} />;
    case "invoices":
      return <Invoices />;
    case "suppliers":
      return <Suppliers searchParams={query} />;
    case "expenses":
      return <Expenses searchParams={query} />;
    case "payment-methods":
      return <PaymentMethods searchParams={query} />;
    case "reports":
      return <Reports searchParams={query} />;
    case "settings":
      return <Settings />;
    case "data":
      return <Data searchParams={query} />;
    case "activity-log":
      return <BranchActivity searchParams={searchParams} />;
    case "users":
      return <UsersPage />;
    default:
      notFound();
  }
}
