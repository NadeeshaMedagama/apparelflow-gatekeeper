import { cn } from "@/lib/cn";

/** ApparelFlow mark: a cut panel with a stitched seam line. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-9", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#1d4ed8" />
      <path d="M9 9.5 13 8c.8 2.2 5.2 2.2 6 0l4 1.5-1.6 4.4L20 13v11h-8V13l-1.4.9L9 9.5Z" fill="#ffffff" />
      <path d="M16 13.5v8.5" stroke="#1d4ed8" strokeWidth="1.4" strokeDasharray="1.6 1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ inverted = false, compact = false }: { inverted?: boolean; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {compact ? null : (
        <span className="leading-tight">
          <span className={cn("block text-[15px] font-bold tracking-tight", inverted ? "text-white" : "text-slate-900")}>
            ApparelFlow
          </span>
          <span className={cn("block text-xs font-medium", inverted ? "text-slate-300" : "text-slate-600")}>
            ERP · Cutting &amp; QC Gate
          </span>
        </span>
      )}
    </span>
  );
}
