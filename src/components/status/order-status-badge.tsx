import { ORDER_STATUS_LABELS, ORDER_STATUS_SHORT_LABELS, type OrderStatus } from "@/domain/order-status";
import { Badge, type BadgeTone } from "@/components/ui/badge";

export const ORDER_STATUS_TONES: Record<OrderStatus, BadgeTone> = {
  CUTTING_IN_PROGRESS: "slate",
  PENDING_VERIFICATION: "blue",
  REJECTED: "red",
  VERIFIED: "green",
  SEWING_IN_PROGRESS: "violet",
};

export function OrderStatusBadge({ status, short = false }: { status: OrderStatus; short?: boolean }) {
  return (
    <Badge tone={ORDER_STATUS_TONES[status]} dot title={status}>
      {short ? ORDER_STATUS_SHORT_LABELS[status] : ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
