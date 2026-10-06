import { Lock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { OrderStatusBadge } from "@/components/status/order-status-badge";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { VerificationRecord } from "@/components/verification/verification-record";
import { VerificationTerminal } from "@/components/verification/verification-terminal";
import { ORDER_STATUS_LABELS } from "@/domain/order-status";
import { formatDateTime, formatInteger, formatYards } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/page-guards";
import { loadOrNotFound } from "@/server/page-data";
import { getVerificationSheet } from "@/server/services/verification";

export const metadata: Metadata = { title: "Verification Terminal" };

export default async function VerificationTerminalPage({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await requirePagePermission("verification:read");
  const { orderId } = await params;
  const sheet = await loadOrNotFound(() => getVerificationSheet(user, orderId));
  const { order } = sheet;
  const active = order.status === "PENDING_VERIFICATION";

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "QC Queue", href: "/verification" }, { label: order.orderNo }]}
        title={
          <span>
            Verification Terminal · <span className="font-mono">{order.orderNo}</span>
          </span>
        }
        meta={
          <>
            <OrderStatusBadge status={order.status} />
            <Badge tone="slate">QC round {order.verificationRound}</Badge>
          </>
        }
      />

      <Card className="mb-6">
        <CardBody>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
            {[
              ["Recipe", `${order.recipe.name}`, order.recipe.recipeCode],
              ["Batch quantity", `${formatInteger(order.targetQty)} garments`, `${sheet.recipe.components.length} components`],
              ["Fabric roll", order.fabricRollId, "Source roll"],
              ["Fabric used", formatYards(order.actualFabricYds), `std ${formatYards(order.expectedFabricYds)}`],
              ["Cut by", order.createdBy.fullName, "Cutting Supervisor"],
              ["Submitted", formatDateTime(order.submittedAt), "to the QC station"],
            ].map(([label, value, sub]) => (
              <div key={label}>
                <dt className="text-xs font-semibold tracking-wide text-slate-600 uppercase">{label}</dt>
                <dd className="mt-1 text-[15px] font-semibold text-slate-900">{value}</dd>
                <dd className="text-xs text-slate-600">{sub}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      {active ? (
        <VerificationTerminal sheet={sheet} verifier={user} />
      ) : (
        <div className="space-y-6">
          <Alert
            tone={order.status === "REJECTED" ? "danger" : order.status === "CUTTING_IN_PROGRESS" ? "warning" : "success"}
            title={`Count sheet locked — ${ORDER_STATUS_LABELS[order.status]}`}
            actions={
              <ButtonLink href="/verification" variant="secondary" size="sm">
                Back to QC queue
              </ButtonLink>
            }
          >
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-4" aria-hidden="true" />
              {order.status === "CUTTING_IN_PROGRESS"
                ? "The batch is being re-cut. It will reappear in the QC queue when resubmitted."
                : "A decision has been recorded for this round. Decisions are immutable."}
            </span>
          </Alert>
          <Card>
            <CardHeader
              title="Verification records"
              description="Every decision for this batch, newest first."
              icon={<ShieldCheck className="size-5" aria-hidden="true" />}
            />
            <CardBody className="space-y-4">
              {sheet.logs.map((log) => (
                <VerificationRecord key={log.id} log={log} />
              ))}
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
