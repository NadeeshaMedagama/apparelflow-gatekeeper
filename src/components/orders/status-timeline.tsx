import { CircleDot, ClipboardCheck, Pencil, PackageCheck, RotateCcw, Scissors, ShieldCheck, ShieldX } from "lucide-react";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/domain/order-status";
import { ROLE_PROFILES } from "@/domain/roles";
import { cn } from "@/lib/cn";
import type { StatusEventDTO } from "@/lib/dto";
import { formatTimestamp } from "@/lib/format";

function describe(event: StatusEventDTO): { title: string; icon: typeof CircleDot; tone: string } {
  if (event.fromStatus === event.toStatus) return { title: "Batch details updated", icon: Pencil, tone: "bg-slate-100 text-slate-700" };
  const map: Record<OrderStatus, { title: string; icon: typeof CircleDot; tone: string }> = {
    CUTTING_IN_PROGRESS:
      event.fromStatus === "REJECTED"
        ? { title: "Re-cut started", icon: RotateCcw, tone: "bg-slate-100 text-slate-700" }
        : { title: "Order created — cutting in progress", icon: Scissors, tone: "bg-slate-100 text-slate-700" },
    PENDING_VERIFICATION: { title: "Submitted to QC station", icon: ClipboardCheck, tone: "bg-blue-100 text-blue-800" },
    REJECTED: { title: "Rejected by verifier", icon: ShieldX, tone: "bg-red-100 text-red-800" },
    VERIFIED: { title: "Verified & released to sewing", icon: ShieldCheck, tone: "bg-green-100 text-green-800" },
    SEWING_IN_PROGRESS: { title: "Sewing assembly started", icon: PackageCheck, tone: "bg-violet-100 text-violet-800" },
  };
  return map[event.toStatus];
}

/** Append-only status history (order_status_events), newest last. */
export function StatusTimeline({ events }: { events: StatusEventDTO[] }) {
  return (
    <ol className="relative space-y-5">
      {events.map((event, index) => {
        const meta = describe(event);
        const Icon = meta.icon;
        const last = index === events.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3">
            {!last ? <span className="absolute top-9 bottom-[-1.25rem] left-[17px] w-px bg-slate-200" aria-hidden="true" /> : null}
            <span className={cn("relative flex size-9 shrink-0 items-center justify-center rounded-full", meta.tone)}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-slate-900">{meta.title}</p>
              <p className="text-xs text-slate-600">
                {event.actor.fullName} · {ROLE_PROFILES[event.actor.role].label}
              </p>
              <p className="tabular text-xs text-slate-600">
                <time dateTime={event.createdAt}>{formatTimestamp(event.createdAt)}</time>
                <span className="sr-only"> — status {ORDER_STATUS_LABELS[event.toStatus]}</span>
              </p>
              {event.note ? <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{event.note}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
