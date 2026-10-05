import { CircleCheck, CircleDashed, OctagonAlert, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { GateEvaluation } from "@/domain/gate";
import { cn } from "@/lib/cn";

export type GateVerdict = "ready" | "blocked" | "incomplete" | "invalid";

export function verdictOf(gate: GateEvaluation, hasInvalidInput: boolean): GateVerdict {
  if (hasInvalidInput) return "invalid";
  if (gate.passed) return "ready";
  if (gate.totals.red > 0 || gate.violations.some((violation) => violation.code !== "UNCOUNTED_COMPONENT")) return "blocked";
  return "incomplete";
}

const VERDICTS: Record<GateVerdict, { title: string; body: string; className: string; icon: ReactNode }> = {
  ready: {
    title: "Gate clear — ready to approve",
    body: "Every component is counted with no shortage. Surplus (yellow) pieces are allowed through.",
    className: "border-green-300 bg-green-50 text-green-900",
    icon: <CircleCheck className="size-6 text-green-700" aria-hidden="true" />,
  },
  blocked: {
    title: "Approval blocked",
    body: "At least one component is short (RED) or missing. The batch can only be rejected for re-cutting.",
    className: "border-red-300 bg-red-50 text-red-900",
    icon: <OctagonAlert className="size-6 text-red-700" aria-hidden="true" />,
  },
  incomplete: {
    title: "Count incomplete",
    body: "Count every component before the batch can be approved.",
    className: "border-slate-300 bg-slate-50 text-slate-900",
    icon: <CircleDashed className="size-6 text-slate-600" aria-hidden="true" />,
  },
  invalid: {
    title: "Fix invalid counts",
    body: "Counts must be whole, non-negative numbers.",
    className: "border-amber-300 bg-amber-50 text-amber-950",
    icon: <TriangleAlert className="size-6 text-amber-700" aria-hidden="true" />,
  },
};

export function GateVerdictBanner({ verdict, gate }: { verdict: GateVerdict; gate: GateEvaluation }) {
  const config = VERDICTS[verdict];
  return (
    <div className={cn("rounded-xl border px-4 py-3.5", config.className)} role="status" aria-live="polite" data-gate={verdict}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{config.icon}</span>
        <div>
          <p className="text-base font-bold">{config.title}</p>
          <p className="mt-0.5 text-sm">{config.body}</p>
        </div>
      </div>
      <dl className="mt-3.5 grid grid-cols-4 gap-2 text-center">
        {[
          { label: "Counted", value: `${gate.totals.counted}/${gate.totals.required}`, className: "bg-white text-slate-900" },
          { label: "Green", value: gate.totals.green, className: "bg-green-100 text-green-900" },
          { label: "Yellow", value: gate.totals.yellow, className: "bg-amber-100 text-amber-900" },
          { label: "Red", value: gate.totals.red + gate.totals.missing, className: "bg-red-100 text-red-900" },
        ].map((item) => (
          <div key={item.label} className={cn("rounded-lg border border-black/5 px-1 py-1.5", item.className)}>
            <dt className="text-[11px] font-semibold tracking-wide uppercase">{item.label}</dt>
            <dd className="tabular text-lg font-bold">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
