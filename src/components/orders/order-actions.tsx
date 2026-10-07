"use client";

import { Pencil, RotateCcw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { OrderStatus } from "@/domain/order-status";
import { apiRequest, ApiRequestError } from "@/lib/api-client";
import type { CuttingOrderDetailDTO, RecipeDTO } from "@/lib/dto";
import { formatInteger } from "@/lib/format";
import { EditOrderDialog } from "./edit-order-dialog";

type ConfirmKind = "submit" | "recut";

/** Status-aware supervisor actions. Each maps to one named transition endpoint. */
export function OrderActions({ order, recipe }: { order: CuttingOrderDetailDTO; recipe: RecipeDTO }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status: OrderStatus = order.status;

  async function run(kind: ConfirmKind) {
    setBusy(true);
    setError(null);
    try {
      const path = kind === "submit" ? "submit" : "recut";
      await apiRequest(`/api/cutting-orders/${order.id}/${path}`, { method: "POST" });
      toast.success(
        kind === "submit" ? `${order.orderNo} submitted for verification` : `Re-cut started for ${order.orderNo}`,
        {
          description:
            kind === "submit"
              ? "The batch is now waiting at the QC station."
              : "Update the fabric used once the missing pieces are cut, then resubmit.",
        },
      );
      setConfirm(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "The action failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {status === "CUTTING_IN_PROGRESS" ? (
        <>
          <Button variant="secondary" onClick={() => setEditing(true)} icon={<Pencil className="size-4" aria-hidden="true" />}>
            Edit details
          </Button>
          <Button onClick={() => setConfirm("submit")} icon={<Send className="size-4" aria-hidden="true" />}>
            Submit for verification
          </Button>
        </>
      ) : null}
      {status === "REJECTED" ? (
        <Button onClick={() => setConfirm("recut")} icon={<RotateCcw className="size-4" aria-hidden="true" />}>
          Start re-cut
        </Button>
      ) : null}

      <EditOrderDialog open={editing} onClose={() => setEditing(false)} order={order} recipe={recipe} />

      <Modal
        open={confirm !== null}
        onClose={() => {
          if (!busy) {
            setConfirm(null);
            setError(null);
          }
        }}
        closeDisabled={busy}
        title={confirm === "recut" ? `Start re-cut for ${order.orderNo}?` : `Submit ${order.orderNo} for verification?`}
        description={
          confirm === "recut"
            ? "The batch returns to cutting so the rejected pieces can be re-cut."
            : "The bundles move to the QC station. Quantities and fabric are locked until a verifier decides."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => confirm && run(confirm)} loading={busy}>
              {confirm === "recut" ? "Start re-cut" : "Submit to QC"}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-slate-700">
          {error ? (
            <Alert tone="danger" role="alert" title="Action failed">
              {error}
            </Alert>
          ) : null}
          {confirm === "submit" ? (
            <p>
              A fresh count sheet will be issued for all {order.expectedComponents.length} components of{" "}
              <strong className="text-slate-900">{order.recipe.name}</strong> (
              {formatInteger(order.expectedComponents.reduce((sum, item) => sum + item.expectedQty, 0))} cut pieces
              expected for {formatInteger(order.targetQty)} garments).
            </p>
          ) : (
            <p>
              The rejection record stays in the audit trail. After re-cutting, update <em>actual fabric used</em> and submit
              the batch again for a new QC round.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
