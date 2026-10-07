"use client";

import { CircleCheck, FlaskConical, Save, ShieldCheck, ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { ComponentThumb } from "@/components/component-thumb";
import { WastageMeter } from "@/components/orders/wastage-meter";
import { TrafficLightBadge } from "@/components/status/traffic-light-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { evaluateVerificationGate, type GateComponentState, type GateViolation } from "@/domain/gate";
import { LIMITS } from "@/domain/limits";
import { calculateExpectedQuantity } from "@/domain/production";
import { classifyComponentCount } from "@/domain/traffic-light";
import { parseWholeNumberInput, type RejectBatchInput } from "@/domain/validation";
import { apiRequest, ApiRequestError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { UserSummaryDTO, VerificationSheetDTO } from "@/lib/dto";
import { formatInteger, formatVariance } from "@/lib/format";
import { ApproveDialog } from "./approve-dialog";
import { GateVerdictBanner, verdictOf } from "./gate-panel";
import { RejectDialog } from "./reject-dialog";

type RowState = GateComponentState | "INVALID";

interface ProbeResult {
  status: number;
  code: string;
  message: string;
  violations: GateViolation[];
}

function initialCounts(sheet: VerificationSheetDTO): Record<string, string> {
  return Object.fromEntries(sheet.items.map((item) => [item.componentId, item.actualQty === null ? "" : String(item.actualQty)]));
}

/**
 * QC count terminal. The traffic lights and the disabled Approve button are a
 * convenience for the verifier; the decision is re-evaluated by the server
 * (approveBatch) from the persisted counts, which is the actual hard stop.
 */
export function VerificationTerminal({ sheet: initialSheet, verifier }: { sheet: VerificationSheetDTO; verifier: UserSummaryDTO }) {
  const router = useRouter();
  const [sheet, setSheet] = useState(initialSheet);
  const [counts, setCounts] = useState<Record<string, string>>(() => initialCounts(initialSheet));
  const [saving, setSaving] = useState(false);
  const [deciding, setDeciding] = useState<"approve" | "reject" | null>(null);
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [probing, setProbing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const { order, recipe } = sheet;
  const savedCounts = useMemo(() => initialCounts(sheet), [sheet]);
  const itemsByComponent = useMemo(() => new Map(sheet.items.map((item) => [item.componentId, item])), [sheet]);

  // Requirements come from the recipe, exactly as on the server.
  const requirements = useMemo(
    () =>
      recipe.components.map((component) => ({
        componentId: component.id,
        componentName: component.componentName,
        expectedQty: calculateExpectedQuantity(order.targetQty, component.piecesPerGarment),
        piecesPerGarment: component.piecesPerGarment,
        imageUrl: component.imageUrl,
      })),
    [recipe, order.targetQty],
  );

  const parsedCounts = useMemo(() => {
    const result: Record<string, { value: number | null; error: string | null }> = {};
    for (const requirement of requirements) {
      const raw = counts[requirement.componentId] ?? "";
      if (raw.trim() === "") {
        result[requirement.componentId] = { value: null, error: null };
        continue;
      }
      const parsed = parseWholeNumberInput(raw, { label: "Count", min: LIMITS.componentCount.min, max: LIMITS.componentCount.max });
      result[requirement.componentId] = parsed.ok ? { value: parsed.value, error: null } : { value: null, error: parsed.error };
    }
    return result;
  }, [counts, requirements]);

  const hasInvalidInput = Object.values(parsedCounts).some((entry) => entry.error !== null);
  const dirtyIds = requirements
    .map((requirement) => requirement.componentId)
    .filter((id) => itemsByComponent.has(id) && (counts[id] ?? "").trim() !== (savedCounts[id] ?? ""));
  const isDirty = dirtyIds.length > 0;

  const gate = useMemo(
    () =>
      evaluateVerificationGate(
        requirements,
        sheet.items.map((item) => ({
          componentId: item.componentId,
          expectedQty: item.expectedQty,
          actualQty: parsedCounts[item.componentId]?.value ?? null,
        })),
      ),
    [requirements, sheet.items, parsedCounts],
  );
  const verdict = verdictOf(gate, hasInvalidInput);
  const canApprove = verdict === "ready" && !saving && deciding === null;

  function rowState(componentId: string, expectedQty: number): RowState {
    if (!itemsByComponent.has(componentId)) return "MISSING";
    const entry = parsedCounts[componentId];
    if (entry?.error) return "INVALID";
    if (entry?.value === null || entry?.value === undefined) return "UNCOUNTED";
    return classifyComponentCount(expectedQty, entry.value);
  }

  function changedPayload() {
    return {
      items: dirtyIds
        .map((componentId) => ({ componentId, actualQty: parsedCounts[componentId]?.value }))
        .filter((entry): entry is { componentId: string; actualQty: number } => typeof entry.actualQty === "number"),
    };
  }

  /** Persists edited counts. Returns false when nothing could be saved. */
  async function saveCounts(options: { quiet?: boolean } = {}): Promise<boolean> {
    if (hasInvalidInput) {
      toast.error("Fix invalid counts before saving");
      return false;
    }
    const payload = changedPayload();
    if (payload.items.length === 0) return true;
    setSaving(true);
    setPageError(null);
    try {
      const updated = await apiRequest<VerificationSheetDTO>(`/api/verifications/${order.id}/items`, { method: "PUT", body: payload });
      setSheet(updated);
      setCounts(initialCounts(updated));
      if (!options.quiet) toast.success("Counts saved", { description: `${payload.items.length} component count(s) recorded.` });
      return true;
    } catch (error) {
      const message = error instanceof ApiRequestError ? error.message : "Counts could not be saved.";
      setPageError(message);
      toast.error("Counts not saved", { description: message });
      if (error instanceof ApiRequestError && error.status === 409) router.refresh();
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function approve(note: string) {
    setDeciding("approve");
    setDialogError(null);
    try {
      if (!(await saveCounts({ quiet: true }))) {
        setDialogError("Counts could not be saved, so the batch was not approved.");
        return;
      }
      await apiRequest(`/api/verifications/${order.id}/approve`, { method: "POST", body: note ? { note } : {} });
      toast.success(`${order.orderNo} verified`, { description: "Released to the Sewing Queue with your signature." });
      setDialog(null);
      router.refresh();
    } catch (error) {
      setDialogError(error instanceof ApiRequestError ? `${error.message} (HTTP ${error.status} · ${error.code})` : "Approval failed.");
    } finally {
      setDeciding(null);
    }
  }

  async function reject(input: RejectBatchInput) {
    setDeciding("reject");
    setDialogError(null);
    try {
      if (!(await saveCounts({ quiet: true }))) {
        setDialogError("Counts could not be saved, so the batch was not rejected.");
        return;
      }
      await apiRequest(`/api/verifications/${order.id}/reject`, { method: "POST", body: input });
      toast.success(`${order.orderNo} rejected`, { description: "Returned to the Cutting Supervisor for re-cutting." });
      setDialog(null);
      router.refresh();
    } catch (error) {
      setDialogError(error instanceof ApiRequestError ? error.message : "Rejection failed.");
    } finally {
      setDeciding(null);
    }
  }

  /** Demonstrates the server-side hard stop: sends the approval the UI refuses to send. */
  async function probeServerGate() {
    setProbing(true);
    setProbe(null);
    try {
      if (!(await saveCounts({ quiet: true }))) return;
      await apiRequest(`/api/verifications/${order.id}/approve`, { method: "POST", body: {} });
      setProbe({ status: 200, code: "APPROVED", message: "The server accepted the approval.", violations: [] });
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const details = error.details as { violations?: GateViolation[] } | undefined;
        setProbe({ status: error.status, code: error.code, message: error.message, violations: details?.violations ?? [] });
      }
    } finally {
      setProbing(false);
    }
  }

  function onCountKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Enter") {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  const shortageSummary =
    gate.components
      .filter((component) => component.state === "RED")
      .map(
        (component) =>
          `${component.componentName}: counted ${formatInteger(component.actualQty ?? 0)} of ${formatInteger(component.expectedQty)} (short by ${formatInteger(component.expectedQty - (component.actualQty ?? 0))}).`,
      )
      .join("\n") || null;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
      <Card>
        <CardHeader
          title="Physical count sheet"
          description="Count every bundle and enter the pieces found. Status is evaluated instantly against the recipe."
          actions={
            isDirty ? (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                {dirtyIds.length} unsaved change{dirtyIds.length === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <CircleCheck className="size-4 text-green-700" aria-hidden="true" />
                All counts saved
              </span>
            )
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption className="sr-only">Component count sheet for {order.orderNo}</caption>
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-700 uppercase">
                  Component
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-700 uppercase">
                  Expected
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-700 uppercase">
                  Actual count
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-700 uppercase">
                  Variance
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-700 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {requirements.map((requirement, index) => {
                const state = rowState(requirement.componentId, requirement.expectedQty);
                const entry = parsedCounts[requirement.componentId];
                const inputId = `count-${requirement.componentId}`;
                const errorId = `${inputId}-error`;
                const variance = entry?.value === null || entry?.value === undefined ? null : entry.value - requirement.expectedQty;
                return (
                  <tr
                    key={requirement.componentId}
                    data-testid={`count-row-${requirement.componentName}`}
                    data-state={state}
                    className={cn(
                      "transition-colors",
                      state === "RED" && "bg-red-50/70",
                      state === "YELLOW" && "bg-amber-50/70",
                      state === "GREEN" && "bg-green-50/50",
                      state === "INVALID" && "bg-amber-50/70",
                      state === "MISSING" && "bg-red-50/70",
                    )}
                  >
                    <td className="relative px-4 py-3">
                      <span className="flex items-center gap-3">
                        <span
                          className={cn(
                            "absolute inset-y-0 left-0 w-1",
                            state === "GREEN" && "bg-green-600",
                            state === "YELLOW" && "bg-amber-500",
                            (state === "RED" || state === "MISSING") && "bg-red-600",
                            state === "UNCOUNTED" && "bg-slate-300",
                            state === "INVALID" && "bg-amber-500",
                          )}
                          aria-hidden="true"
                        />
                        <ComponentThumb imageUrl={requirement.imageUrl} size="sm" />
                        <span>
                          <label htmlFor={inputId} className="block font-semibold whitespace-nowrap text-slate-900">
                            {requirement.componentName}
                          </label>
                          <span className="block text-xs whitespace-nowrap text-slate-600">
                            {requirement.piecesPerGarment} {requirement.piecesPerGarment === 1 ? "pc" : "pcs"} / garment
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="tabular px-4 py-3 text-right text-base font-bold text-slate-900">
                      {formatInteger(requirement.expectedQty)}
                    </td>
                    <td className="px-4 py-3">
                      {state === "MISSING" ? (
                        <span className="text-sm font-medium text-red-800">Not on count sheet</span>
                      ) : (
                        <div className="w-28">
                          <input
                            ref={(node) => {
                              inputRefs.current[index] = node;
                            }}
                            id={inputId}
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="Count"
                            value={counts[requirement.componentId] ?? ""}
                            onChange={(event) => setCounts((current) => ({ ...current, [requirement.componentId]: event.target.value }))}
                            onKeyDown={(event) => onCountKeyDown(event, index)}
                            aria-invalid={state === "INVALID" || undefined}
                            aria-describedby={entry?.error ? errorId : undefined}
                            disabled={saving || deciding !== null}
                            className={cn(
                              "tabular block h-11 w-full rounded-lg border bg-white px-3 text-right text-base font-semibold text-slate-900 shadow-xs",
                              "placeholder:font-normal placeholder:text-slate-500",
                              "focus:border-blue-700 focus:ring-3 focus:ring-blue-600/25 focus:outline-none",
                              "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600",
                              state === "INVALID" ? "border-red-700" : state === "RED" ? "border-red-600" : "border-slate-500",
                            )}
                          />
                          {entry?.error ? (
                            <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-red-700">
                              {entry.error}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td
                      className={cn(
                        "tabular px-4 py-3 text-right text-base font-bold",
                        variance !== null && variance < 0 && "text-red-700",
                        variance !== null && variance > 0 && "text-amber-800",
                        variance === 0 && "text-green-800",
                        variance === null && "text-slate-500",
                      )}
                    >
                      {formatVariance(variance)}
                    </td>
                    <td className="px-4 py-3">
                      {state === "INVALID" ? (
                        <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
                          Invalid entry
                        </span>
                      ) : (
                        <TrafficLightBadge state={state} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <CardBody className="border-t border-slate-200 bg-slate-50/70">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-700">
            <li className="flex items-center gap-2">
              <TrafficLightBadge state="GREEN" /> actual = expected
            </li>
            <li className="flex items-center gap-2">
              <TrafficLightBadge state="YELLOW" /> actual &gt; expected · may proceed
            </li>
            <li className="flex items-center gap-2">
              <TrafficLightBadge state="RED" /> actual &lt; expected · blocks approval
            </li>
          </ul>
        </CardBody>
      </Card>

      <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
        <Card>
          <CardHeader title="Gatekeeper decision" description="Approval requires every component counted with no shortage." />
          <CardBody className="space-y-4">
            <GateVerdictBanner verdict={verdict} gate={gate} />

            {gate.violations.length > 0 && verdict !== "incomplete" ? (
              <ul className="space-y-1.5 text-sm text-red-900" aria-label="Blocking issues">
                {gate.violations
                  .filter((violation) => violation.code !== "UNCOUNTED_COMPONENT")
                  .map((violation) => (
                    <li key={`${violation.code}-${violation.componentId ?? "x"}`} className="flex gap-2">
                      <span aria-hidden="true">•</span>
                      {violation.message}
                    </li>
                  ))}
              </ul>
            ) : null}

            {pageError ? (
              <Alert tone="danger" role="alert">
                {pageError}
              </Alert>
            ) : null}

            <div className="grid gap-2">
              <Button
                variant="success"
                size="lg"
                disabled={!canApprove}
                onClick={() => {
                  setDialogError(null);
                  setDialog("approve");
                }}
                icon={<ShieldCheck className="size-5" aria-hidden="true" />}
                data-testid="approve-batch"
                aria-describedby="approve-help"
              >
                Approve batch
              </Button>
              <p id="approve-help" className="text-xs text-slate-600">
                {canApprove
                  ? "Your identity and the server time will be recorded on the approval."
                  : "Disabled while any component is red, missing, uncounted or invalid. The API enforces the same rule."}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void saveCounts()}
                  loading={saving}
                  disabled={!isDirty || hasInvalidInput || deciding !== null}
                  icon={<Save className="size-4" aria-hidden="true" />}
                >
                  Save counts
                </Button>
                <Button
                  variant="danger-outline"
                  onClick={() => {
                    setDialogError(null);
                    setDialog("reject");
                  }}
                  disabled={saving || deciding !== null || hasInvalidInput}
                  icon={<ShieldX className="size-4" aria-hidden="true" />}
                  data-testid="reject-batch"
                >
                  Reject batch
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Fabric wastage" description="Computed by the server and stored with the decision." />
          <CardBody>
            <WastageMeter wastagePct={sheet.wastage.wastagePct} wastageCap={sheet.wastage.wastageCap} />
          </CardBody>
        </Card>

        {verdict !== "ready" ? (
          <Card>
            <CardHeader
              title="Enforcement check"
              description="Send this approval to the API anyway to see the server-side hard stop respond."
              icon={<FlaskConical className="size-5" aria-hidden="true" />}
            />
            <CardBody className="space-y-3">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => void probeServerGate()}
                loading={probing}
                disabled={hasInvalidInput || saving || deciding !== null}
                data-testid="probe-server-gate"
              >
                POST /api/verifications/…/approve
              </Button>
              {probe ? (
                <div
                  data-testid="probe-result"
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm",
                    probe.status === 200 ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900",
                  )}
                >
                  <p className="font-mono text-xs font-bold">
                    HTTP {probe.status} · {probe.code}
                  </p>
                  <p className="mt-1">{probe.message}</p>
                  {probe.violations.length > 0 ? (
                    <ul className="mt-1.5 list-inside list-disc text-xs">
                      {probe.violations.map((violation) => (
                        <li key={`${violation.code}-${violation.componentId ?? "x"}`}>{violation.message}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </CardBody>
          </Card>
        ) : null}
      </div>

      {dialog === "approve" ? (
        <ApproveDialog
          open
          orderNo={order.orderNo}
          verifierName={verifier.fullName}
          gate={gate}
          wastage={sheet.wastage}
          busy={deciding === "approve"}
          serverError={dialogError}
          onCancel={() => setDialog(null)}
          onConfirm={(note) => void approve(note)}
        />
      ) : null}
      {dialog === "reject" ? (
        <RejectDialog
          open
          orderNo={order.orderNo}
          defaultCategory={gate.totals.red > 0 ? "COMPONENT_SHORTAGE" : "COUNT_MISMATCH"}
          shortageSummary={shortageSummary}
          busy={deciding === "reject"}
          serverError={dialogError}
          onCancel={() => setDialog(null)}
          onConfirm={(input) => void reject(input)}
        />
      ) : null}
    </div>
  );
}
