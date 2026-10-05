"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { LIMITS } from "@/domain/limits";
import type { GateEvaluation } from "@/domain/gate";
import type { WastageResult } from "@/domain/wastage";
import { formatPercent } from "@/lib/format";

export function ApproveDialog({
  open,
  orderNo,
  verifierName,
  gate,
  wastage,
  busy,
  serverError,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  orderNo: string;
  verifierName: string;
  gate: GateEvaluation;
  wastage: WastageResult;
  busy: boolean;
  serverError: string | null;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const tooLong = note.trim().length > LIMITS.approvalNote.max;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      closeDisabled={busy}
      size="lg"
      title={`Approve ${orderNo}?`}
      description="This signs the batch off under your identity and releases it to the Sewing Queue. The record cannot be edited afterwards."
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={() => onConfirm(note.trim())}
            loading={busy}
            disabled={tooLong}
            icon={<ShieldCheck className="size-4" aria-hidden="true" />}
          >
            Approve &amp; release
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {serverError ? (
          <Alert tone="danger" role="alert" title="Approval rejected by the server">
            {serverError}
          </Alert>
        ) : null}
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ["Verifier", verifierName],
            ["Components", `${gate.totals.counted} of ${gate.totals.required} counted`],
            ["Surplus (yellow)", String(gate.totals.yellow)],
            ["Fabric wastage", formatPercent(wastage.wastagePct, { signed: true })],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 px-3 py-2.5">
              <dt className="text-xs font-medium text-slate-600">{label}</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
        {gate.totals.yellow > 0 ? (
          <Alert tone="warning" title="Surplus pieces recorded">
            {gate.totals.yellow} component{gate.totals.yellow === 1 ? " has" : "s have"} more pieces than expected. Note what happens
            to the surplus (returned to stores or kept as a safety margin).
          </Alert>
        ) : null}
        <FormField
          id="approval-note"
          label="Note for the sewing floor (optional)"
          error={tooLong ? `Keep the note under ${LIMITS.approvalNote.max} characters` : undefined}
          hint="Visible to the Sewing Supervisor with the approval record."
        >
          {(describedBy) => (
            <Textarea
              id="approval-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              invalid={tooLong}
              aria-describedby={describedBy}
              rows={3}
              placeholder="e.g. 2 surplus collars kept as a safety margin."
            />
          )}
        </FormField>
      </div>
    </Modal>
  );
}
