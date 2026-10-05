"use client";

import { ArrowRight, KeyRound } from "lucide-react";
import { useState } from "react";
import { ROLE_PROFILES, type Role } from "@/domain/roles";
import { cn } from "@/lib/cn";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { signInAsDemo } from "@/components/layout/session-controls";

const ACCENTS: Record<Role, { bar: string; chip: string; button: string }> = {
  CUTTING_SUPERVISOR: {
    bar: "bg-blue-600",
    chip: "border-blue-200 bg-blue-50 text-blue-800",
    button: "bg-blue-700 hover:bg-blue-800",
  },
  CUTTING_VERIFIER: {
    bar: "bg-green-600",
    chip: "border-green-200 bg-green-50 text-green-800",
    button: "bg-emerald-700 hover:bg-emerald-800",
  },
  SEWING_SUPERVISOR: {
    bar: "bg-orange-600",
    chip: "border-orange-200 bg-orange-50 text-orange-800",
    button: "bg-orange-700 hover:bg-orange-800",
  },
};

/**
 * Demo credential panel required by the brief. Each button performs a real
 * login with the persona's seeded credentials.
 */
export function DemoPersonas() {
  const [pending, setPending] = useState<Role | null>(null);

  return (
    <section aria-labelledby="demo-personas-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="demo-personas-title" className="text-base font-semibold text-slate-900">
            Demo personas
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">Real accounts with server-enforced permissions.</p>
        </div>
        <p className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
          <KeyRound className="size-3.5 text-slate-600" aria-hidden="true" />
          Password <code className="font-mono font-semibold text-slate-900">{DEMO_PASSWORD}</code>
        </p>
      </div>
      <ul className="mt-4 grid gap-3">
        {DEMO_ACCOUNTS.map((account) => {
          const profile = ROLE_PROFILES[account.role];
          const accent = ACCENTS[account.role];
          return (
            <li key={account.role} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
              <span className={cn("absolute inset-y-0 left-0 w-1", accent.bar)} aria-hidden="true" />
              <div className="flex flex-col gap-3 py-3.5 pr-3.5 pl-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{profile.label}</span>
                    <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold", accent.chip)}>
                      {profile.code}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-slate-700">
                    {account.fullName} · <span className="font-mono text-[13px]">{account.email}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{profile.restriction}</p>
                </div>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={async () => {
                    setPending(account.role);
                    await signInAsDemo(account);
                    setPending(null);
                  }}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700",
                    "disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600",
                    accent.button,
                  )}
                >
                  {pending === account.role ? "Signing in…" : `Sign in as ${profile.label}`}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
