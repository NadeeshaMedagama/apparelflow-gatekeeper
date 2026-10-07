import { Lock, ShieldCheck, ShieldX } from "lucide-react";
import { ROLE_PROFILES } from "@/domain/roles";
import { REJECTION_CATEGORY_LABELS } from "@/domain/order-status";
import { TrafficLightBadge } from "@/components/status/traffic-light-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import type { VerificationLogDTO } from "@/lib/dto";
import { formatInteger, formatPercent, formatTimestamp, formatVariance, formatYards } from "@/lib/format";

/**
 * Read-only rendering of an immutable QC decision: who decided, when, the
 * fabric wastage and the per-component count snapshot taken at that moment.
 */
export function VerificationRecord({ log, compact = false }: { log: VerificationLogDTO; compact?: boolean }) {
  const approved = log.decision === "APPROVED";
  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border",
        approved ? "border-green-200 bg-green-50/40" : "border-red-200 bg-red-50/40",
      )}
      aria-label={`QC round ${log.round} — ${approved ? "approved" : "rejected"}`}
    >
      <header className="flex flex-col gap-3 border-b border-inherit px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
              approved ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800",
            )}
          >
            {approved ? <ShieldCheck className="size-5" aria-hidden="true" /> : <ShieldX className="size-5" aria-hidden="true" />}
          </span>
          <div>
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
              {approved ? "Approved & released" : "Rejected — returned for re-cut"}
              <Badge tone={approved ? "green" : "red"}>QC round {log.round}</Badge>
              {log.rejectionCategory ? <Badge tone="red">{REJECTION_CATEGORY_LABELS[log.rejectionCategory]}</Badge> : null}
            </p>
            <p className="mt-0.5 text-sm text-slate-700">
              {log.verifier.fullName} · {ROLE_PROFILES[log.verifier.role].label} ·{" "}
              <time dateTime={log.timestamp} className="tabular">
                {formatTimestamp(log.timestamp)}
              </time>
            </p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <Lock className="size-3.5" aria-hidden="true" />
          Immutable record
        </p>
      </header>

      <div className="space-y-4 bg-white px-4 py-4">
        {log.rejectionNote ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
            <p className="text-xs font-semibold tracking-wide text-red-800 uppercase">Rejection reason</p>
            <p className="mt-1 text-sm whitespace-pre-line text-slate-900">{log.rejectionNote}</p>
          </div>
        ) : null}
        {log.approvalNote ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
            <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">Verifier note</p>
            <p className="mt-1 text-sm whitespace-pre-line text-slate-900">{log.approvalNote}</p>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 px-3 py-2.5">
            <dt className="text-xs font-medium text-slate-600">Fabric wastage</dt>
            <dd className={cn("tabular mt-0.5 text-lg font-bold", log.exceedsWastageCap ? "text-amber-800" : "text-slate-900")}>
              {formatPercent(log.wastagePct, { signed: true })}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2.5">
            <dt className="text-xs font-medium text-slate-600">Wastage cap</dt>
            <dd className="tabular mt-0.5 text-lg font-bold text-slate-900">{formatPercent(log.wastageCap)}</dd>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2.5">
            <dt className="text-xs font-medium text-slate-600">Expected fabric</dt>
            <dd className="tabular mt-0.5 text-lg font-bold text-slate-900">{formatYards(log.expectedFabricYds)}</dd>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2.5">
            <dt className="text-xs font-medium text-slate-600">Actual fabric</dt>
            <dd className="tabular mt-0.5 text-lg font-bold text-slate-900">{formatYards(log.actualFabricYds)}</dd>
          </div>
        </dl>

        {compact ? null : (
          <TableContainer label={`Component counts, QC round ${log.round}`} className="rounded-lg border border-slate-200">
            <Table>
              <caption className="sr-only">Component counts recorded in QC round {log.round}</caption>
              <THead>
                <tr>
                  <Th>Component</Th>
                  <Th className="text-right">Expected</Th>
                  <Th className="text-right">Counted</Th>
                  <Th className="text-right">Variance</Th>
                  <Th>Status</Th>
                </tr>
              </THead>
              <TBody>
                {log.items.map((item) => (
                  <Tr key={item.componentId}>
                    <Td className="font-medium text-slate-900">{item.componentName}</Td>
                    <Td className="tabular text-right">{formatInteger(item.expectedQty)}</Td>
                    <Td className="tabular text-right font-semibold text-slate-900">
                      {item.actualQty === null ? "—" : formatInteger(item.actualQty)}
                    </Td>
                    <Td
                      className={cn(
                        "tabular text-right font-semibold",
                        item.variance !== null && item.variance < 0 && "text-red-700",
                        item.variance !== null && item.variance > 0 && "text-amber-800",
                      )}
                    >
                      {formatVariance(item.variance)}
                    </Td>
                    <Td>
                      <TrafficLightBadge state={item.status ?? "UNCOUNTED"} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
      </div>
    </article>
  );
}
