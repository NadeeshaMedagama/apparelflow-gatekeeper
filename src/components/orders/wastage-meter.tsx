import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";

/**
 * Visual comparison of fabric wastage against the recipe cap. The cap is an
 * operational warning — the brief does not make it a hard stop.
 */
export function WastageMeter({ wastagePct, wastageCap }: { wastagePct: number; wastageCap: number }) {
  const exceeds = wastagePct > wastageCap;
  const scaleMax = Math.max(wastageCap * 2, wastagePct, 1);
  const fill = Math.min(Math.max(wastagePct, 0) / scaleMax, 1) * 100;
  const capMark = (wastageCap / scaleMax) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className={cn("tabular text-2xl font-bold", exceeds ? "text-amber-800" : "text-slate-900")}>
          {formatPercent(wastagePct, { signed: true })}
        </p>
        <p className="text-sm text-slate-600">
          Cap <span className="tabular font-semibold text-slate-900">{formatPercent(wastageCap)}</span>
        </p>
      </div>
      <div
        className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200"
        role="meter"
        aria-label="Fabric wastage against cap"
        aria-valuemin={0}
        aria-valuemax={scaleMax}
        aria-valuenow={Math.max(wastagePct, 0)}
        aria-valuetext={`${formatPercent(wastagePct)} of a ${formatPercent(wastageCap)} cap`}
      >
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full", exceeds ? "bg-amber-500" : "bg-green-600")}
          style={{ width: `${fill}%` }}
        />
        <span className="absolute inset-y-0 w-0.5 bg-slate-900" style={{ left: `${capMark}%` }} aria-hidden="true" />
      </div>
      <p className={cn("mt-2 text-sm", exceeds ? "font-medium text-amber-900" : "text-slate-600")}>
        {wastagePct < 0
          ? "Batch used less fabric than the recipe standard."
          : exceeds
            ? "Above the recipe wastage cap — flagged for review (does not block approval)."
            : "Within the recipe wastage cap."}
      </p>
    </div>
  );
}
