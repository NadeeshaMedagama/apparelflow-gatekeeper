import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Horizontally scrollable table wrapper. It is focusable so keyboard users can
 * scroll wide tables (WCAG 2.1.1), with a visible focus ring.
 */
export function TableContainer({ className, label = "Scrollable table", ...props }: ComponentProps<"div"> & { label?: string }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn("overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700", className)}
      {...props}
    />
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("border-b border-slate-200 bg-slate-50", className)} {...props} />;
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn("px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap text-slate-700 uppercase", className)}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-slate-200", className)} {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-slate-50/80", className)} {...props} />;
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 py-3.5 align-middle text-slate-800", className)} {...props} />;
}
