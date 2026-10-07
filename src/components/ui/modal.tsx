"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Accessible modal built on the native <dialog> element: the browser supplies
 * focus trapping, inert background, Escape handling and top-layer stacking.
 * React state stays the single source of truth for open/closed.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeDisabled = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
  closeDisabled?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const widths = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-5xl" };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-raised",
        widths[size],
      )}
    >
      {open ? (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1 text-sm text-slate-600">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              className="-mr-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:text-slate-400"
              aria-label="Close dialog"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? (
            <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              {footer}
            </footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
