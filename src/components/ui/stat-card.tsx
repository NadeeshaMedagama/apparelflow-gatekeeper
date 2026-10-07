import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "slate" | "blue" | "green" | "amber" | "red" | "violet";

const tones: Record<Tone, { icon: string; bar: string }> = {
  slate: { icon: "bg-slate-100 text-slate-700", bar: "bg-slate-400" },
  blue: { icon: "bg-blue-50 text-blue-700", bar: "bg-blue-600" },
  green: { icon: "bg-green-50 text-green-700", bar: "bg-green-600" },
  amber: { icon: "bg-amber-50 text-amber-700", bar: "bg-amber-500" },
  red: { icon: "bg-red-50 text-red-700", bar: "bg-red-600" },
  violet: { icon: "bg-violet-50 text-violet-700", bar: "bg-violet-600" },
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "slate",
  href,
  active = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  href?: string;
  active?: boolean;
}) {
  const style = tones[tone];
  const content = (
    <>
      <span className={cn("absolute inset-y-0 left-0 w-1 rounded-l-xl", style.bar)} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <p className="tabular mt-1.5 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        {icon ? (
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", style.icon)}>{icon}</span>
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-sm text-slate-600">{hint}</p> : null}
    </>
  );

  const className = cn(
    "relative block overflow-hidden rounded-xl border bg-white py-4 pr-4 pl-5 shadow-card transition",
    active ? "border-blue-600 ring-2 ring-blue-600/20" : "border-slate-200",
    href && "hover:border-slate-300 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700",
  );

  return href ? (
    <Link href={href} className={className} aria-current={active ? "true" : undefined}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
