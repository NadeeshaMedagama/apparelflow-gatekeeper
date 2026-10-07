import { ClipboardCheck, PackageCheck, Scissors, ShieldCheck, ShieldX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateOrderDialog } from "@/components/orders/create-order-dialog";
import { OrdersTable } from "@/components/orders/orders-table";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { isOrderStatus, ORDER_STATUS_SHORT_LABELS, ORDER_STATUSES, type OrderStatus } from "@/domain/order-status";
import { cn } from "@/lib/cn";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getOrderStatusCounts, listCuttingOrders } from "@/server/services/cutting-orders";
import { listRecipes } from "@/server/services/recipes";

export const metadata: Metadata = { title: "Cutting Orders" };

const KPI: Array<{ status: OrderStatus; label: string; hint: string; tone: "slate" | "blue" | "red" | "green" | "violet"; icon: typeof Scissors }> = [
  { status: "CUTTING_IN_PROGRESS", label: "In cutting", hint: "On the cutting table", tone: "slate", icon: Scissors },
  { status: "PENDING_VERIFICATION", label: "Pending QC", hint: "Waiting for a verifier", tone: "blue", icon: ClipboardCheck },
  { status: "REJECTED", label: "Rejected", hint: "Needs re-cut & resubmit", tone: "red", icon: ShieldX },
  { status: "VERIFIED", label: "Verified", hint: "In the sewing queue", tone: "green", icon: ShieldCheck },
  { status: "SEWING_IN_PROGRESS", label: "In sewing", hint: "On the assembly line", tone: "violet", icon: PackageCheck },
];

export default async function CuttingOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  const user = await requirePagePermission("order:read");
  const { status } = await searchParams;
  const filter = isOrderStatus(status) ? status : undefined;

  const [orders, counts, recipes] = await Promise.all([
    listCuttingOrders(user, { status: filter }),
    getOrderStatusCounts(user),
    listRecipes(user),
  ]);
  const total = ORDER_STATUSES.reduce((sum, key) => sum + counts[key], 0);

  return (
    <>
      <PageHeader
        title="Cutting Orders"
        description="Create production batches from recipes, log fabric consumption and track each batch through QC to the sewing floor."
        actions={<CreateOrderDialog recipes={recipes} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {KPI.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <StatCard
              key={kpi.status}
              label={kpi.label}
              value={counts[kpi.status]}
              hint={kpi.hint}
              tone={kpi.tone}
              icon={<Icon className="size-5" aria-hidden="true" />}
              href={filter === kpi.status ? "/cutting" : `/cutting?status=${kpi.status}`}
              active={filter === kpi.status}
            />
          );
        })}
      </div>

      <Card>
        <div className="border-b border-slate-200 px-4 pt-3">
          <nav aria-label="Filter orders by status" className="-mb-px flex gap-1 overflow-x-auto">
            {[{ key: undefined, label: "All orders", count: total }, ...ORDER_STATUSES.map((key) => ({ key, label: ORDER_STATUS_SHORT_LABELS[key], count: counts[key] }))].map(
              (tab) => {
                const active = tab.key === filter;
                return (
                  <Link
                    key={tab.key ?? "all"}
                    href={tab.key ? `/cutting?status=${tab.key}` : "/cutting"}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap",
                      "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-700",
                      active ? "border-blue-700 text-blue-800" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
                    )}
                  >
                    {tab.label}
                    <span
                      className={cn(
                        "tabular rounded-full px-2 py-0.5 text-xs",
                        active ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700",
                      )}
                    >
                      {tab.count}
                    </span>
                  </Link>
                );
              },
            )}
          </nav>
        </div>
        <OrdersTable
          orders={orders}
          emptyMessage={
            filter
              ? "No orders match this status. Choose another filter or create a new cutting order."
              : "Create the first cutting order to start the production pipeline."
          }
        />
      </Card>
    </>
  );
}
