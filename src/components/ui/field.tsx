import { AlertCircle, ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Form controls with explicit, high-contrast colours in every state:
 * ink text on white, a visible slate-500 border, a thick blue focus ring,
 * a red border + icon + message when invalid, and a readable disabled state.
 */
const controlBase =
  "block w-full rounded-lg border bg-white text-[15px] text-slate-900 shadow-xs transition-colors " +
  "placeholder:text-slate-500 " +
  "hover:border-slate-600 " +
  "focus:border-blue-700 focus:outline-none focus:ring-3 focus:ring-blue-600/25 " +
  "disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-600 " +
  "read-only:bg-slate-50";

const validState = "border-slate-500";
const invalidState = "border-red-700 hover:border-red-800 focus:border-red-700 focus:ring-red-600/25";

interface ControlProps {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: ComponentProps<"input"> & ControlProps) {
  return (
    <input
      className={cn(controlBase, "h-11 px-3.5", invalid ? invalidState : validState, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Textarea({ className, invalid, ...props }: ComponentProps<"textarea"> & ControlProps) {
  return (
    <textarea
      className={cn(controlBase, "min-h-28 px-3.5 py-2.5 leading-relaxed", invalid ? invalidState : validState, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({ className, invalid, children, ...props }: ComponentProps<"select"> & ControlProps) {
  return (
    <div className="relative">
      <select
        className={cn(controlBase, "h-11 appearance-none pr-10 pl-3.5", invalid ? invalidState : validState, className)}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-slate-600"
        aria-hidden="true"
      />
    </div>
  );
}

export function Label({ className, children, required, ...props }: ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label className={cn("mb-1.5 block text-sm font-semibold text-slate-800", className)} {...props}>
      {children}
      {required ? (
        <span className="ml-0.5 text-red-700" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-sm text-slate-600">
      {children}
    </p>
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-red-700">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (describedBy: string | undefined) => ReactNode;
}

/** Label + control + hint + inline error, wired together with aria-describedby. */
export function FormField({ id, label, required, hint, error, className, children }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children(describedBy)}
      {error ? <FieldError id={errorId}>{error}</FieldError> : hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
    </div>
  );
}
