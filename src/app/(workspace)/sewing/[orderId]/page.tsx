import { Factory, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { StartSewingButton } from "@/components/sewing/start-sewing-button";
import { OrderStatusBadge } from "@/components/status/order-status-badge";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { VerificationRecord } from "@/components/verification/verification-record";
import { formatDateTime, formatInteger } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/page-guards";
import { loadOrNotFound } from "@/server/page-data";
import { getSewingBatch } from "@/server/services/sewing";

export const metadata: Metadata = { title: "Verified Batch" };

export default async function SewingBatchPage({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await requirePagePermission("sewing:read");
  const { orderId } = await params;
  const batch = await loadOrNotFound(() => getSewingBatch(user, orderId));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Sewing Queue", href: "/sewing" }, { label: batch.orderNo }]}
        title={<span className="font-mono">{batch.orderNo}</span>}
        description={`${batch.recipe.name} (${batch.recipe.recipeCode}) · ${formatInteger(batch.targetQty)} garments · roll ${batch.fabricRollId}`}
        meta={<OrderStatusBadge status={batch.status} />}
        actions={
          batch.status === "VERIFIED" ? (
            <StartSewingButton orderId={batch.id} orderNo={batch.orderNo} recipeName={batch.recipe.name} targetQty={batch.targetQty} size="lg" />
          ) : null
        }
      />

      <div className="space-y-6">
        {batch.status === "SEWING_IN_PROGRESS" ? (
          <Alert tone="success" title="On the assembly line">
            Sewing started {formatDateTime(batch.sewingStartedAt)} by {batch.sewingStartedBy?.fullName}.
          </Alert>
        ) : (
          <Alert tone="info" title="Ready for assembly">
            Verified {formatDateTime(batch.verifiedAt)} by {batch.approval.verifier.fullName}. Review the counts below before
            releasing the bundles to the line.
          </Alert>
        )}

        <Card>
          <CardHeader
            title="Verification audit record"
            description="Verifier attribution, timestamp, per-component counts and fabric wastage — written by the server at approval and immutable."
            icon={<ShieldCheck className="size-5" aria-hidden="true" />}
          />
          <CardBody>
            <VerificationRecord log={batch.approval} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Assembly hand-off" icon={<Factory className="size-5" aria-hidden="true" />} />
          <CardBody>
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold tracking-wide text-slate-600 uppercase">Verified at</dt>
                <dd className="tabular mt-1 font-semibold text-slate-900">{formatDateTime(batch.verifiedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-slate-600 uppercase">Verifier ID</dt>
                <dd className="mt-1 font-mono text-xs break-all text-slate-900">{batch.approval.verifier.id}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-slate-600 uppercase">Sewing started</dt>
                <dd className="tabular mt-1 font-semibold text-slate-900">
                  {batch.sewingStartedAt ? `${formatDateTime(batch.sewingStartedAt)} · ${batch.sewingStartedBy?.fullName ?? ""}` : "Not started"}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
