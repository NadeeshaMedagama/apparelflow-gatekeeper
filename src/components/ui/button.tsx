import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "success" | "danger" | "danger-outline" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 " +
  // Disabled states stay legible (no opacity fade): slate-600 on slate-200 ≈ 6:1.
  "disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-600 disabled:shadow-none " +
  "aria-disabled:cursor-not-allowed aria-disabled:border-slate-300 aria-disabled:bg-slate-200 aria-disabled:text-slate-600";

const variants: Record<Variant, string> = {
  primary: "bg-blue-700 text-white shadow-sm hover:bg-blue-800 active:bg-blue-900",
  secondary: "border border-slate-300 bg-white text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100",
  success: "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 active:bg-emerald-900",
  danger: "bg-red-700 text-white shadow-sm hover:bg-red-800 active:bg-red-900",
  "danger-outline": "border border-red-300 bg-white text-red-700 shadow-sm hover:border-red-400 hover:bg-red-50 active:bg-red-100",
  ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string): string {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function ButtonLink({ variant = "secondary", size = "md", icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
