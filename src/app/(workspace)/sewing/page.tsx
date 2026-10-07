import { ArrowRight, Factory, PackageCheck, Shirt, ShieldCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StartSewingButton } from "@/components/sewing/start-sewing-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { formatDateTime, formatInteger, formatPercent } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/page-guards";
import { getAssemblyInProgress, getSewingQueue, getSewingStats } from "@/server/services/sewing";

export const metadata: Metadata = { title: "Sewing Queue" };

export default async function SewingQueuePage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const user = await requirePagePermission("sewing:read");
  const { view } = await searchParams;
  const showAssembly = view === "assembly";
  const [queue, assembly, stats] = await Promise.all([getSewingQueue(user), getAssemblyInProgress(user), getSewingStats(user)]);

  return (
    <>
      <PageHeader
        title="Sewing Queue"
        description="Verified batches released by QC. Only batches that passed component-by-component verification ever appear here."
      />

      <Alert tone="info" title="Verified batches only" className="mb-6">
        This queue is filtered by the database query itself (<code className="font-mono text-[13px]">status = VERIFIED</code>).
        Pending, rejected and in-cutting orders are never sent to this workspace.
      </Alert>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Ready for assembly" value={stats.ready} hint="Verified batches in the queue" tone="green" icon={<PackageCheck className="size-5" aria-hidden="true" />} href="/sewing" active={!showAssembly} />
        <StatCard label="Garments ready" value={formatInteger(stats.garmentsReady)} hint="Across queued batches" tone="blue" icon={<Shirt className="size-5" aria-hidden="true" />} />
        <StatCard label="On the assembly line" value={stats.inAssembly} hint="Sewing in progress" tone="violet" icon={<Factory className="size-5" aria-hidden="true" />} href="/sewing?view=assembly" active={showAssembly} />
      </div>

      <nav aria-label="Sewing views" className="mb-4 flex gap-2">
        {[
          { href: "/sewing", label: `Ready queue (${queue.length})`, active: !showAssembly },
          { href: "/sewing?view=assembly", label: `In assembly (${assembly.length})`, active: showAssembly },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3.5 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700",
              tab.active ? "bg-navy-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {!showAssembly ? (
        queue.length === 0 ? (
          <Card>
            <EmptyState
              icon={<PackageCheck className="size-6" aria-hidden="true" />}
              title="No verified batches waiting"
              description="Batches appear here the moment a Cutting Verifier approves them."
            />
          </Card>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2" aria-label="Verified batches ready for assembly">
            {queue.map((batch) => {
              const surplus = batch.approval.items.filter((item) => item.status === "YELLOW").length;
              return (
                <li key={batch.id} data-testid={`sewing-batch-${batch.orderNo}`}>
                  <Card className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                      <div>
                        <p className="font-mono text-base font-bold text-slate-900">{batch.orderNo}</p>
                        <p className="text-sm text-slate-700">
                          {batch.recipe.name} · <span className="font-mono text-xs">{batch.recipe.recipeCode}</span>
                        </p>
                      </div>
                      <Badge tone="green" dot>
                        Verified
                      </Badge>
                    </div>
                    <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-xs font-medium text-slate-600">Batch</dt>
                        <dd className="tabular font-semibold text-slate-900">{formatInteger(batch.targetQty)} garments</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-slate-600">Components</dt>
                        <dd className="font-semibold text-slate-900">
                          {batch.approval.items.length} verified{surplus > 0 ? ` · ${surplus} surplus` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-slate-600">Fabric wastage</dt>
                        <dd className={cn("tabular font-semibold", batch.approval.exceedsWastageCap ? "text-amber-800" : "text-slate-900")}>
                          {formatPercent(batch.approval.wastagePct, { signed: true })}
                        </dd>
                      </div>
                      <div className="col-span-2 sm:col-span-3">
                        <dt className="text-xs font-medium text-slate-600">Verified by</dt>
                        <dd className="flex flex-wrap items-center gap-x-2 text-slate-900">
                          <UserRound className="size-4 text-slate-600" aria-hidden="true" />
                          <span className="font-semibold">{batch.approval.verifier.fullName}</span>
                          <span className="tabular text-slate-700">· {formatDateTime(batch.verifiedAt)}</span>
                        </dd>
                      </div>
                      {batch.approval.approvalNote ? (
                        <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-3">
                          <dt className="text-xs font-semibold text-slate-700">Verifier note</dt>
                          <dd className="text-slate-900">{batch.approval.approvalNote}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3">
                      <ButtonLink href={`/sewing/${batch.id}`} variant="secondary" icon={<ShieldCheck className="size-4" aria-hidden="true" />}>
                        Review audit record
                      </ButtonLink>
                      <StartSewingButton orderId={batch.id} orderNo={batch.orderNo} recipeName={batch.recipe.name} targetQty={batch.targetQty} />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <Card>
          {assembly.length === 0 ? (
            <EmptyState icon={<Factory className="size-6" aria-hidden="true" />} title="Nothing on the assembly line" description="Start a verified batch from the ready queue." />
          ) : (
            <TableContainer label="Batches on the assembly line">
              <Table>
                <caption className="sr-only">Batches on the assembly line</caption>
                <THead>
                  <tr>
                    <Th>Order</Th>
                    <Th>Recipe</Th>
                    <Th className="text-right">Batch qty</Th>
                    <Th>Verified</Th>
                    <Th>Sewing started</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </THead>
                <TBody>
                  {assembly.map((batch) => (
                    <Tr key={batch.id}>
                      <Td className="font-mono text-sm font-semibold text-slate-900">{batch.orderNo}</Td>
                      <Td>{batch.recipe.name}</Td>
                      <Td className="tabular text-right font-semibold">{formatInteger(batch.targetQty)}</Td>
                      <Td className="whitespace-nowrap">
                        <span className="tabular block text-sm">{formatDateTime(batch.verifiedAt)}</span>
                        <span className="block text-xs text-slate-600">{batch.approval.verifier.fullName}</span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="tabular block text-sm">{formatDateTime(batch.sewingStartedAt)}</span>
                        <span className="block text-xs text-slate-600">{batch.sewingStartedBy?.fullName}</span>
                      </Td>
                      <Td className="text-right">
                        <Link
                          href={`/sewing/${batch.id}`}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"
                        >
                          Audit record <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      )}
    </>
  );
}
