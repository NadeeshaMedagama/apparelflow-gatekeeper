"use client";

import { BookOpen, ClipboardCheck, History, PackageCheck, Scissors, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { NavIcon, NavItem } from "./navigation";

const ICONS: Record<NavIcon, LucideIcon> = {
  cutting: Scissors,
  queue: ClipboardCheck,
  history: History,
  sewing: PackageCheck,
  recipes: BookOpen,
};

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) {
    // "/verification" is active for the queue and the terminal, but not for the log.
    return pathname === item.href || (pathname.startsWith(`${item.href}/`) && !pathname.startsWith(`${item.href}/history`));
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400",
                active ? "bg-navy-700 text-white" : "text-slate-300 hover:bg-navy-800 hover:text-white",
              )}
            >
              {active ? <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-blue-400" aria-hidden="true" /> : null}
              <Icon className={cn("size-5 shrink-0", active ? "text-blue-300" : "text-slate-400 group-hover:text-slate-200")} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-semibold">{item.label}</span>
                <span className={cn("block text-xs", active ? "text-slate-300" : "text-slate-400")}>{item.description}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
