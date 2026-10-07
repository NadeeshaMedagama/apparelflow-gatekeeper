"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { apiRequest, ApiRequestError } from "@/lib/api-client";
import { formatInteger } from "@/lib/format";

export function StartSewingButton({
  orderId,
  orderNo,
  recipeName,
  targetQty,
  size = "md",
}: {
  orderId: string;
  orderNo: string;
  recipeName: string;
  targetQty: number;
  size?: "sm" | "md" | "lg";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/sewing/queue/${orderId}/start`, { method: "POST" });
      toast.success(`Sewing assembly started for ${orderNo}`, { description: "The batch is now on the assembly line." });
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Could not start sewing assembly.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)} icon={<Play className="size-4" aria-hidden="true" />} data-testid={`start-sewing-${orderNo}`}>
        Start sewing assembly
      </Button>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        closeDisabled={busy}
        title={`Start sewing ${orderNo}?`}
        description="Releases the verified bundles to the assembly line."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={start} loading={busy} icon={<Play className="size-4" aria-hidden="true" />}>
              Start assembly
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-slate-700">
          {error ? (
            <Alert tone="danger" role="alert" title="Not started">
              {error}
            </Alert>
          ) : null}
          <p>
            <strong className="text-slate-900">{recipeName}</strong> · {formatInteger(targetQty)} garments. The start time and
            your name are recorded on the batch.
          </p>
        </div>
      </Modal>
    </>
  );
}
