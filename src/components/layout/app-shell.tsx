import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ROLE_PROFILES } from "@/domain/roles";
import type { UserSummaryDTO } from "@/lib/dto";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { navigationFor, ROLE_STAGE } from "./navigation";
import { PipelineIndicator } from "./pipeline-indicator";
import { RoleSwitcher, UserMenu } from "./session-controls";

export function AppShell({ user, children }: { user: UserSummaryDTO; children: ReactNode }) {
  const items = navigationFor(user.role);
  const profile = ROLE_PROFILES[user.role];

  return (
    <div className="min-h-screen lg:pl-72">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold text-blue-800 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-navy-900 px-4 py-5 lg:flex">
        <div className="px-2">
          <Logo inverted />
        </div>
        <div className="mt-6 rounded-lg border border-navy-700 bg-navy-800/60 px-3 py-2.5">
          <p className="text-xs font-semibold tracking-wide text-slate-300 uppercase">Workspace</p>
          <p className="mt-0.5 text-sm font-semibold text-white">{profile.label}</p>
          <p className="font-mono text-xs text-slate-300">{profile.code}</p>
        </div>
        <nav aria-label="Workspace" className="mt-5 flex-1">
          <NavLinks items={items} />
        </nav>
        <PipelineIndicator stage={ROLE_STAGE[user.role]} />
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <MobileNav items={items} />
            <div className="lg:hidden">
              <Logo compact />
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="text-sm font-semibold text-slate-900">Cutting Operations &amp; Gatekeeper Verification</p>
              <p className="text-xs text-slate-600">Production batch verification · Sewing queue gate</p>
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <RoleSwitcher user={user} />
              <UserMenu user={user} />
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>

        <footer className="border-t border-slate-200 bg-white px-4 py-4 text-xs text-slate-600 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2">
            <span>ApparelFlow ERP · Cutting Operations &amp; Gatekeeper Verification Terminal</span>
            <span>All approvals are enforced and audited server-side.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
