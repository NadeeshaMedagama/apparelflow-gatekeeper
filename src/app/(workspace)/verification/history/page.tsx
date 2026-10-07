import { History, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { REJECTION_CATEGORY_LABELS } from "@/domain/order-status";
import { cn } from "@/lib/cn";
import { formatInteger, formatPercent, formatTimestamp } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listDecisionHistory } from "@/server/services/verification";

export const metadata: Metadata = { title: "Decision Log" };

export default async function DecisionLogPage() {
  const user = await requirePagePermission("verification:read");
  const decisions = await listDecisionHistory(user, { limit: 100 });

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "QC Queue", href: "/verification" }, { label: "Decision log" }]}
        title="Decision Log"
        description="Append-only record of every QC decision. Entries cannot be edited or deleted — the database rejects it."
        meta={
          <Badge tone="slate">
            <Lock className="size-3" aria-hidden="true" /> Immutable
          </Badge>
        }
      />
      <Card>
        <CardHeader title="Recent decisions" description="Latest 100 approvals and rejections across all verifiers." />
        {decisions.length === 0 ? (
          <EmptyState icon={<History className="size-6" aria-hidden="true" />} title="No decisions yet" />
        ) : (
          <TableContainer label="QC decision log">
            <Table>
              <caption className="sr-only">QC decision log</caption>
              <THead>
                <tr>
                  <Th>Timestamp</Th>
                  <Th>Order</Th>
                  <Th>Decision</Th>
                  <Th className="text-right">Wastage</Th>
                  <Th>Verifier</Th>
                  <Th>Note</Th>
                </tr>
              </THead>
              <TBody>
                {decisions.map((entry) => (
                  <Tr key={entry.id}>
                    <Td className="tabular whitespace-nowrap text-sm">{formatTimestamp(entry.timestamp)}</Td>
                    <Td>
                      <Link
                        href={`/verification/${entry.order.id}`}
                        className="font-mono text-sm font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-blue-700"
                      >
                        {entry.order.orderNo}
                      </Link>
                      <span className="block text-xs text-slate-600">
                        {entry.order.recipe.name} · {formatInteger(entry.order.targetQty)} pcs · round {entry.round}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={entry.decision === "APPROVED" ? "green" : "red"} dot>
                        {entry.decision === "APPROVED" ? "Approved" : "Rejected"}
                      </Badge>
                      {entry.rejectionCategory ? (
                        <span className="mt-1 block text-xs text-slate-600">{REJECTION_CATEGORY_LABELS[entry.rejectionCategory]}</span>
                      ) : null}
                    </Td>
                    <Td className={cn("tabular text-right font-semibold", entry.exceedsWastageCap ? "text-amber-800" : "text-slate-900")}>
                      {formatPercent(entry.wastagePct, { signed: true })}
                    </Td>
                    <Td className="whitespace-nowrap">{entry.verifier.fullName}</Td>
                    <Td className="max-w-md">
                      <span className="line-clamp-2 text-sm text-slate-700">{entry.note ?? "—"}</span>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </>
  );
}
