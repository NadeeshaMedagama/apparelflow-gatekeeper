import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "danger";

const tones: Record<Tone, { wrapper: string; icon: ReactNode; title: string }> = {
  info: {
    wrapper: "border-blue-200 bg-blue-50 text-blue-900",
    icon: <Info className="size-5 text-blue-700" aria-hidden="true" />,
    title: "text-blue-900",
  },
  success: {
    wrapper: "border-green-200 bg-green-50 text-green-900",
    icon: <CheckCircle2 className="size-5 text-green-700" aria-hidden="true" />,
    title: "text-green-900",
  },
  warning: {
    wrapper: "border-amber-300 bg-amber-50 text-amber-950",
    icon: <AlertTriangle className="size-5 text-amber-700" aria-hidden="true" />,
    title: "text-amber-950",
  },
  danger: {
    wrapper: "border-red-200 bg-red-50 text-red-900",
    icon: <OctagonAlert className="size-5 text-red-700" aria-hidden="true" />,
    title: "text-red-900",
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  role,
  actions,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: "alert" | "status";
  actions?: ReactNode;
}) {
  const style = tones[tone];
  return (
    <div role={role} className={cn("flex gap-3 rounded-xl border px-4 py-3.5", style.wrapper, className)}>
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {title ? <p className={cn("font-semibold", style.title)}>{title}</p> : null}
        {children ? <div className={cn(title ? "mt-1" : undefined)}>{children}</div> : null}
        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
