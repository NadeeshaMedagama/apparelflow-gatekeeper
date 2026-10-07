"use client";

import { ListPlus, ShieldX } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { LIMITS } from "@/domain/limits";
import { REJECTION_CATEGORIES, REJECTION_CATEGORY_LABELS, type RejectionCategory } from "@/domain/order-status";
import { rejectBatchSchema, type RejectBatchInput } from "@/domain/validation";

export function RejectDialog({
  open,
  orderNo,
  defaultCategory,
  shortageSummary,
  busy,
  serverError,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  orderNo: string;
  defaultCategory: RejectionCategory;
  shortageSummary: string | null;
  busy: boolean;
  serverError: string | null;
  onCancel: () => void;
  onConfirm: (input: RejectBatchInput) => void;
}) {
  const [category, setCategory] = useState<RejectionCategory>(defaultCategory);
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);

  const parsed = rejectBatchSchema.safeParse({ reason, category });
  const reasonError = !parsed.success && (attempted || reason.length > 0)
    ? parsed.error.issues.find((issue) => issue.path[0] === "reason")?.message
    : undefined;
  const trimmedLength = reason.trim().length;

  function submit() {
    setAttempted(true);
    if (parsed.success) onConfirm(parsed.data);
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      closeDisabled={busy}
      size="lg"
      title={`Reject ${orderNo}`}
      description="The batch returns to the Cutting Supervisor for re-cutting. A reason is mandatory and becomes part of the permanent audit record."
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={busy} icon={<ShieldX className="size-4" aria-hidden="true" />}>
            Reject batch
          </Button>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-5"
      >
        {serverError ? (
          <Alert tone="danger" role="alert" title="Rejection not recorded">
            {serverError}
          </Alert>
        ) : null}
        <FormField id="rejection-category" label="Defect category" required>
          {(describedBy) => (
            <Select
              id="rejection-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as RejectionCategory)}
              aria-describedby={describedBy}
            >
              {REJECTION_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {REJECTION_CATEGORY_LABELS[item]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          id="rejection-reason"
          label="Reason for rejection"
          required
          error={reasonError}
          hint={`Describe the defect and what must be re-cut (at least ${LIMITS.rejectionReason.min} characters).`}
        >
          {(describedBy) => (
            <>
              <Textarea
                id="rejection-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                invalid={Boolean(reasonError)}
                aria-describedby={describedBy}
                maxLength={LIMITS.rejectionReason.max}
                placeholder="e.g. Sleeve Cuffs short by 2 pieces (98 of 100). Re-cut 2 cuffs from the same roll."
                rows={5}
                required
              />
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                {shortageSummary ? (
                  <button
                    type="button"
                    onClick={() => setReason((current) => (current.trim() ? `${current.trim()}\n${shortageSummary}` : shortageSummary))}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"
                  >
                    <ListPlus className="size-4" aria-hidden="true" />
                    Insert shortage summary
                  </button>
                ) : (
                  <span />
                )}
                <span className="tabular text-xs text-slate-600">
                  {trimmedLength} / {LIMITS.rejectionReason.max}
                </span>
              </div>
            </>
          )}
        </FormField>
      </form>
    </Modal>
  );
}
