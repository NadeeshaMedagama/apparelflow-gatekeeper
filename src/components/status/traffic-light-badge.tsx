import { CircleCheck, CircleDashed, CircleHelp, OctagonAlert, TriangleAlert } from "lucide-react";
import type { GateComponentState } from "@/domain/gate";
import { cn } from "@/lib/cn";

/**
 * Traffic-light status pill. Every state pairs colour with an icon and a text
 * label so the signal never depends on colour perception alone.
 */
const STATES: Record<GateComponentState, { label: string; className: string; icon: typeof CircleCheck }> = {
  GREEN: { label: "Green · Match", className: "border-green-300 bg-green-100 text-green-900", icon: CircleCheck },
  YELLOW: { label: "Yellow · Excess", className: "border-amber-300 bg-amber-100 text-amber-900", icon: TriangleAlert },
  RED: { label: "Red · Shortage", className: "border-red-300 bg-red-100 text-red-900", icon: OctagonAlert },
  UNCOUNTED: { label: "Not counted", className: "border-slate-300 bg-slate-100 text-slate-800", icon: CircleDashed },
  MISSING: { label: "Missing", className: "border-red-300 bg-white text-red-900", icon: CircleHelp },
};

export function TrafficLightBadge({ state, className }: { state: GateComponentState; className?: string }) {
  const config = STATES[state];
  const Icon = config.icon;
  return (
    <span
      data-state={state}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap",
        config.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {config.label}
    </span>
  );
}
