"use client";

import { Menu as MenuIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { NavLinks } from "./nav-links";
import type { NavItem } from "./navigation";

/** Slide-over navigation drawer for small screens (native <dialog>). */
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700 lg:hidden"
        aria-label="Open navigation"
      >
        <MenuIcon className="size-6" aria-hidden="true" />
      </button>
      <dialog
        ref={ref}
        aria-label="Navigation"
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        className="m-0 h-dvh max-h-dvh w-[min(20rem,85vw)] max-w-none bg-navy-900 p-0 text-white"
      >
        <div className="flex h-full flex-col px-4 py-5">
          <div className="mb-6 flex items-center justify-between">
            <Logo inverted />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-slate-300 hover:bg-navy-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400"
              aria-label="Close navigation"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Workspace">
            <NavLinks items={items} onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      </dialog>
    </>
  );
}
