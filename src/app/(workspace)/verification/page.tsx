import { ArrowRight, ClipboardCheck, History, ShieldCheck, ShieldX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateTime, formatInteger } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getVerificationStats, listPendingVerifications } from "@/server/services/verification";

export const metadata: Metadata = { title: "QC Queue" };

export default async function VerificationQueuePage() {
  const user = await requirePagePermission("verification:read");
  const [pending, stats] = await Promise.all([listPendingVerifications(user), getVerificationStats(user)]);

  return (
    <>
      <PageHeader
        title="QC Queue"
        description="Batches waiting at the verification station, oldest first. Count every component before approving or rejecting."
        actions={
          <ButtonLink href="/verification/history" icon={<History className="size-4" aria-hidden="true" />}>
            Decision log
          </ButtonLink>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Awaiting verification" value={stats.pending} hint="Batches at the QC station" tone="blue" icon={<ClipboardCheck className="size-5" aria-hidden="true" />} />
        <StatCard label="Approved · 24h" value={stats.approved24h} hint="Released to sewing" tone="green" icon={<ShieldCheck className="size-5" aria-hidden="true" />} />
        <StatCard label="Rejected · 24h" value={stats.rejected24h} hint="Returned for re-cut" tone="red" icon={<ShieldX className="size-5" aria-hidden="true" />} />
        <StatCard label="My decisions" value={stats.myDecisions} hint={`Signed by ${user.fullName}`} tone="slate" icon={<History className="size-5" aria-hidden="true" />} />
      </div>

      <Card>
        <CardHeader title="Pending verification" description="First in, first out — the oldest submission is at the top." />
        {pending.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="size-6" aria-hidden="true" />}
            title="The QC station is clear"
            description="No batches are waiting for verification. New submissions from the cutting room appear here."
          />
        ) : (
          <TableContainer label="Batches pending verification">
            <Table>
              <caption className="sr-only">Batches pending verification</caption>
              <THead>
                <tr>
                  <Th>Order</Th>
                  <Th>Recipe</Th>
                  <Th className="text-right">Batch qty</Th>
                  <Th>Count progress</Th>
                  <Th>Submitted</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </THead>
              <TBody>
                {pending.map((order) => {
                  const percent = order.componentCount === 0 ? 0 : Math.round((order.countedCount / order.componentCount) * 100);
                  return (
                    <Tr key={order.id}>
                      <Td>
                        <span className="block font-mono text-sm font-semibold text-slate-900">{order.orderNo}</span>
                        {order.verificationRound > 1 ? (
                          <Badge tone="amber" className="mt-1">
                            Re-check · round {order.verificationRound}
                          </Badge>
                        ) : null}
                      </Td>
                      <Td>
                        <span className="block font-medium text-slate-900">{order.recipe.name}</span>
                        <span className="block font-mono text-xs text-slate-600">{order.recipe.recipeCode}</span>
                      </Td>
                      <Td className="tabular text-right font-semibold text-slate-900">{formatInteger(order.targetQty)}</Td>
                      <Td>
                        <div className="w-40">
                          <div className="flex justify-between text-xs text-slate-700">
                            <span>
                              {order.countedCount} of {order.componentCount} counted
                            </span>
                            <span className="tabular">{percent}%</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-slate-200" aria-hidden="true">
                            <div className="h-2 rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="tabular block text-sm text-slate-800">{formatDateTime(order.submittedAt)}</span>
                        <span className="block text-xs text-slate-600">by {order.createdBy.fullName}</span>
                      </Td>
                      <Td className="text-right">
                        <Link
                          href={`/verification/${order.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                        >
                          Open terminal
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </>
  );
}
