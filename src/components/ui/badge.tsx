import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "slate" | "blue" | "green" | "amber" | "red" | "violet" | "orange";

const tones: Record<BadgeTone, { badge: string; dot: string }> = {
  slate: { badge: "border-slate-300 bg-slate-100 text-slate-800", dot: "bg-slate-500" },
  blue: { badge: "border-blue-200 bg-blue-50 text-blue-800", dot: "bg-blue-600" },
  green: { badge: "border-green-200 bg-green-50 text-green-800", dot: "bg-green-600" },
  amber: { badge: "border-amber-300 bg-amber-50 text-amber-900", dot: "bg-amber-500" },
  red: { badge: "border-red-200 bg-red-50 text-red-800", dot: "bg-red-600" },
  violet: { badge: "border-violet-200 bg-violet-50 text-violet-800", dot: "bg-violet-600" },
  orange: { badge: "border-orange-200 bg-orange-50 text-orange-800", dot: "bg-orange-600" },
};

export function Badge({
  tone = "slate",
  children,
  dot = false,
  className,
  title,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
  title?: string;
}) {
  const style = tones[tone];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        style.badge,
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
