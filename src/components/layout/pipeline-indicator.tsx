import { cn } from "@/lib/cn";
import type { PipelineStage } from "./navigation";

const STAGES: Array<{ key: PipelineStage; label: string }> = [
  { key: "cutting", label: "Cutting" },
  { key: "qc", label: "QC Gate" },
  { key: "sewing", label: "Sewing" },
];

/** Shows where the signed-in persona sits in the production pipeline. */
export function PipelineIndicator({ stage }: { stage: PipelineStage }) {
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-800/60 p-3.5">
      <p className="text-xs font-semibold tracking-wide text-slate-300 uppercase">Your station</p>
      <ol className="mt-3 flex items-center gap-1.5" aria-label="Production pipeline">
        {STAGES.map((item, index) => {
          const current = item.key === stage;
          return (
            <li key={item.key} className="flex flex-1 items-center gap-1.5">
              <span
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex-1 rounded-md px-1.5 py-1.5 text-center text-[11px] font-bold",
                  current ? "bg-blue-600 text-white" : "bg-navy-700 text-slate-200",
                )}
              >
                {item.label}
              </span>
              {index < STAGES.length - 1 ? (
                <span className="text-slate-400" aria-hidden="true">
                  ›
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs leading-relaxed text-slate-300">
        Batches reach sewing only after a verifier signs off on every component.
      </p>
    </div>
  );
}
