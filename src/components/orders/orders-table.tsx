import { ArrowRight, Inbox } from "lucide-react";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/status/order-status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import type { CuttingOrderSummaryDTO } from "@/lib/dto";
import { formatDateTime, formatInteger, formatYards } from "@/lib/format";

export function OrdersTable({ orders, emptyMessage }: { orders: CuttingOrderSummaryDTO[]; emptyMessage: string }) {
  if (orders.length === 0) {
    return <EmptyState icon={<Inbox className="size-6" aria-hidden="true" />} title="No cutting orders" description={emptyMessage} />;
  }
  return (
    <TableContainer label="Cutting orders">
      <Table>
        <caption className="sr-only">Cutting orders</caption>
        <THead>
          <tr>
            <Th>Order</Th>
            <Th>Recipe</Th>
            <Th className="text-right">Batch qty</Th>
            <Th>Fabric roll</Th>
            <Th className="text-right">Fabric used</Th>
            <Th>Status</Th>
            <Th>Created</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </THead>
        <TBody>
          {orders.map((order) => (
            <Tr key={order.id}>
              <Td>
                <Link
                  href={`/cutting/orders/${order.id}`}
                  className="font-mono text-sm font-semibold whitespace-nowrap text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  {order.orderNo}
                </Link>
                {order.verificationRound > 1 ? (
                  <span className="mt-0.5 block text-xs text-slate-600">QC round {order.verificationRound}</span>
                ) : null}
              </Td>
              <Td>
                <span className="block font-medium whitespace-nowrap text-slate-900">{order.recipe.name}</span>
                <span className="block font-mono text-xs text-slate-600">{order.recipe.recipeCode}</span>
              </Td>
              <Td className="tabular text-right font-semibold text-slate-900">{formatInteger(order.targetQty)}</Td>
              <Td className="font-mono text-sm whitespace-nowrap">{order.fabricRollId}</Td>
              <Td className="tabular text-right">
                <span className="block font-semibold text-slate-900">{formatYards(order.actualFabricYds)}</span>
                <span className="block text-xs text-slate-600">std {formatYards(order.expectedFabricYds)}</span>
              </Td>
              <Td>
                <OrderStatusBadge status={order.status} short />
              </Td>
              <Td className="whitespace-nowrap">
                <span className="tabular block text-sm text-slate-800">{formatDateTime(order.createdAt)}</span>
                <span className="block text-xs text-slate-600">{order.createdBy.fullName}</span>
              </Td>
              <Td className="text-right">
                <Link
                  href={`/cutting/orders/${order.id}`}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"
                  aria-label={`Open ${order.orderNo}`}
                >
                  {order.status === "REJECTED" ? "Review" : "Open"}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableContainer>
  );
}
