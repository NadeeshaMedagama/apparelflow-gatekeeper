"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface MenuItem {
  key: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  selected?: boolean;
  onSelect: () => void;
}

/**
 * Keyboard-accessible dropdown menu (WAI-ARIA menu button pattern):
 * Enter/Space/ArrowDown opens, arrows move, Escape closes and restores focus.
 */
export function Menu({
  label,
  trigger,
  items,
  align = "end",
  header,
  triggerClassName,
}: {
  label: string;
  trigger: ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  header?: ReactNode;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const focusItem = useCallback((index: number) => {
    const nodes = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
    if (!nodes || nodes.length === 0) return;
    nodes[(index + nodes.length) % nodes.length]?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    const frame = requestAnimationFrame(() => focusItem(0));
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      cancelAnimationFrame(frame);
    };
  }, [open, focusItem]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes = Array.from(
      containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    const current = nodes.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(current + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(current - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(nodes.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700",
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-raised",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {header ? <div className="px-3 pt-2 pb-2.5">{header}</div> : null}
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              aria-current={item.selected || undefined}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-800 outline-none",
                "hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-700",
                "disabled:cursor-default disabled:hover:bg-transparent",
                item.selected && "bg-blue-50 hover:bg-blue-50",
              )}
            >
              {item.icon ? <span className="mt-0.5 shrink-0">{item.icon}</span> : null}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">{item.label}</span>
                {item.description ? <span className="mt-0.5 block text-xs text-slate-600">{item.description}</span> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
