import { Clock, Layers, ListChecks, Ruler, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { ExpectedComponentsTable } from "@/components/orders/expected-components-table";
import { OrderActions } from "@/components/orders/order-actions";
import { StatusTimeline } from "@/components/orders/status-timeline";
import { WastageMeter } from "@/components/orders/wastage-meter";
import { OrderStatusBadge } from "@/components/status/order-status-badge";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { VerificationRecord } from "@/components/verification/verification-record";
import { REJECTION_CATEGORY_LABELS } from "@/domain/order-status";
import { formatDateTime, formatInteger, formatYards } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/page-guards";
import { loadOrNotFound } from "@/server/page-data";
import { getCuttingOrder } from "@/server/services/cutting-orders";

export const metadata: Metadata = { title: "Cutting Order" };

const STATUS_NOTICE = {
  PENDING_VERIFICATION: {
    tone: "info" as const,
    title: "At the QC station",
    body: "A Cutting Verifier is counting the bundles. Quantities and fabric are locked until a decision is recorded.",
  },
  VERIFIED: {
    tone: "success" as const,
    title: "Verified and released to the Sewing Queue",
    body: "Every component passed verification. The approval record below is immutable.",
  },
  SEWING_IN_PROGRESS: {
    tone: "success" as const,
    title: "On the assembly line",
    body: "The sewing floor has started assembling this verified batch.",
  },
};

export default async function CuttingOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("order:read");
  const { id } = await params;
  const order = await loadOrNotFound(() => getCuttingOrder(user, id));

  const latestLog = order.verificationLogs[0];
  const latestRejection = order.verificationLogs.find((log) => log.decision === "REJECTED");
  const showRejection =
    latestRejection && (order.status === "REJECTED" || (order.status === "CUTTING_IN_PROGRESS" && latestLog?.decision === "REJECTED"));
  const shortages = latestRejection?.items.filter((item) => item.status === "RED") ?? [];
  const notice = order.status in STATUS_NOTICE ? STATUS_NOTICE[order.status as keyof typeof STATUS_NOTICE] : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Cutting Orders", href: "/cutting" }, { label: order.orderNo }]}
        title={<span className="font-mono">{order.orderNo}</span>}
        description={`${order.recipe.name} (${order.recipe.recipeCode}) · ${formatInteger(order.targetQty)} garments · roll ${order.fabricRollId}`}
        meta={
          <>
            <OrderStatusBadge status={order.status} />
            {order.verificationRound > 0 ? <Badge tone="slate">QC round {order.verificationRound}</Badge> : null}
          </>
        }
        actions={<OrderActions order={order} recipe={order.recipeDetail} />}
      />

      <div className="space-y-6">
        {showRejection && latestRejection ? (
          <Alert
            tone="danger"
            role="alert"
            title={`Rejected in QC round ${latestRejection.round} — ${latestRejection.rejectionCategory ? REJECTION_CATEGORY_LABELS[latestRejection.rejectionCategory] : "Rejected"}`}
          >
            <p className="whitespace-pre-line">{latestRejection.rejectionNote}</p>
            {shortages.length > 0 ? (
              <ul className="mt-2 list-inside list-disc">
                {shortages.map((item) => (
                  <li key={item.componentId}>
                    <strong>{item.componentName}</strong>: counted {formatInteger(item.actualQty ?? 0)} of{" "}
                    {formatInteger(item.expectedQty)} (short by {formatInteger(item.expectedQty - (item.actualQty ?? 0))})
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-red-800">
              {order.status === "REJECTED"
                ? "Start a re-cut, update the fabric used, then resubmit the batch for a new QC round."
                : "Re-cut in progress: update the fabric used if needed, then submit for verification."}{" "}
              — {latestRejection.verifier.fullName}, {formatDateTime(latestRejection.timestamp)}
            </p>
          </Alert>
        ) : notice ? (
          <Alert tone={notice.tone} title={notice.title}>
            {notice.body}
          </Alert>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Expected components"
                description="Derived by the multiplier engine from the recipe and the target quantity."
                icon={<Layers className="size-5" aria-hidden="true" />}
              />
              <CardBody>
                <ExpectedComponentsTable components={order.expectedComponents} targetQty={order.targetQty} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="QC decisions"
                description="Immutable verification records, newest first."
                icon={<ShieldCheck className="size-5" aria-hidden="true" />}
              />
              <CardBody className="space-y-4">
                {order.verificationLogs.length === 0 ? (
                  <p className="text-sm text-slate-600">No verification decisions yet.</p>
                ) : (
                  order.verificationLogs.map((log) => <VerificationRecord key={log.id} log={log} />)
                )}
              </CardBody>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Batch details" icon={<ListChecks className="size-5" aria-hidden="true" />} />
              <CardBody>
                <dl className="divide-y divide-slate-200 text-sm">
                  {[
                    ["Recipe", `${order.recipe.name} · ${order.recipe.recipeCode}`],
                    ["Category", order.recipe.category],
                    ["Target quantity", `${formatInteger(order.targetQty)} garments`],
                    ["Fabric roll", order.fabricRollId],
                    ["Created by", order.createdBy.fullName],
                    ["Created", formatDateTime(order.createdAt)],
                    ["Last submitted", formatDateTime(order.submittedAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 py-2.5">
                      <dt className="text-slate-600">{label}</dt>
                      <dd className="text-right font-medium text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Fabric & wastage" icon={<Ruler className="size-5" aria-hidden="true" />} />
              <CardBody className="space-y-4">
                <dl className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                    <dt className="text-xs font-medium text-slate-600">Expected fabric</dt>
                    <dd className="tabular mt-0.5 font-bold text-slate-900">{formatYards(order.projectedWastage.expectedFabricYds)}</dd>
                  </div>
                  <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                    <dt className="text-xs font-medium text-slate-600">Actual fabric used</dt>
                    <dd className="tabular mt-0.5 font-bold text-slate-900">{formatYards(order.actualFabricYds)}</dd>
                  </div>
                </dl>
                <WastageMeter wastagePct={order.projectedWastage.wastagePct} wastageCap={order.projectedWastage.wastageCap} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Timeline" description="Append-only status history" icon={<Clock className="size-5" aria-hidden="true" />} />
              <CardBody>
                <StatusTimeline events={order.events} />
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
