"use client";

import { Check, ChevronDown, LogOut, Repeat } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Menu } from "@/components/ui/menu";
import { ROLE_PROFILES, type Role } from "@/domain/roles";
import { apiRequest, ApiRequestError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoAccount } from "@/lib/demo-accounts";
import type { UserSummaryDTO } from "@/lib/dto";

export const ROLE_ACCENT: Record<Role, { chip: string; avatar: string }> = {
  CUTTING_SUPERVISOR: { chip: "border-blue-200 bg-blue-50 text-blue-800", avatar: "bg-blue-700 text-white" },
  CUTTING_VERIFIER: { chip: "border-green-200 bg-green-50 text-green-800", avatar: "bg-emerald-700 text-white" },
  SEWING_SUPERVISOR: { chip: "border-orange-200 bg-orange-50 text-orange-800", avatar: "bg-orange-700 text-white" },
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Re-authenticates as another demo persona through the real login endpoint.
 * Nothing about the role is decided in the browser: the server issues a new
 * session for the selected account and every page re-checks permissions.
 */
export async function signInAsDemo(account: DemoAccount): Promise<void> {
  const profile = ROLE_PROFILES[account.role];
  const toastId = toast.loading(`Signing in as ${profile.label}…`);
  try {
    const result = await apiRequest<{ redirectTo: string }>("/api/auth/login", {
      method: "POST",
      body: { email: account.email, password: DEMO_PASSWORD },
    });
    toast.success(`Signed in as ${account.fullName}`, { id: toastId, description: profile.label });
    window.location.assign(result.redirectTo);
  } catch (error) {
    toast.error("Could not switch role", {
      id: toastId,
      description: error instanceof ApiRequestError ? error.message : "Unexpected error. Please try again.",
    });
  }
}

export async function signOut(): Promise<void> {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.assign("/login");
  }
}

export function RoleSwitcher({ user }: { user: UserSummaryDTO }) {
  const profile = ROLE_PROFILES[user.role];
  return (
    <Menu
      label="Demo role switcher"
      triggerClassName="rounded-lg"
      header={
        <div>
          <p className="text-sm font-semibold text-slate-900">Demo role switcher</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Re-authenticates as the selected persona. Permissions are enforced by the server.
          </p>
        </div>
      }
      trigger={
        <span className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-xs hover:border-slate-400 hover:bg-slate-50">
          <Repeat className="size-4 text-slate-600" aria-hidden="true" />
          <span className="hidden sm:inline">Switch role</span>
          <span className={cn("rounded-full border px-2 py-0.5 text-xs", ROLE_ACCENT[user.role].chip)}>{profile.code}</span>
          <ChevronDown className="size-4 text-slate-600" aria-hidden="true" />
        </span>
      }
      items={DEMO_ACCOUNTS.map((account) => {
        const accountProfile = ROLE_PROFILES[account.role];
        const current = account.role === user.role;
        return {
          key: account.role,
          selected: current,
          disabled: current,
          label: (
            <span className="flex items-center justify-between gap-2">
              {accountProfile.label}
              {current ? <Check className="size-4 text-blue-700" aria-label="Current role" /> : null}
            </span>
          ),
          description: `${account.fullName} · ${account.email}`,
          icon: (
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-xs font-bold",
                ROLE_ACCENT[account.role].avatar,
              )}
            >
              {initials(account.fullName)}
            </span>
          ),
          onSelect: () => void signInAsDemo(account),
        };
      })}
    />
  );
}

export function UserMenu({ user }: { user: UserSummaryDTO }) {
  const [busy, setBusy] = useState(false);
  const profile = ROLE_PROFILES[user.role];
  return (
    <Menu
      label="Account menu"
      triggerClassName="rounded-full"
      header={
        <div>
          <p className="text-sm font-semibold text-slate-900">{user.fullName}</p>
          <p className="text-xs text-slate-600">{user.email}</p>
          <p className={cn("mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", ROLE_ACCENT[user.role].chip)}>
            {profile.label}
          </p>
        </div>
      }
      trigger={
        <span className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-slate-100">
          <span className={cn("flex size-9 items-center justify-center rounded-full text-sm font-bold", ROLE_ACCENT[user.role].avatar)}>
            {initials(user.fullName)}
          </span>
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-sm font-semibold text-slate-900">{user.fullName}</span>
            <span className="block text-xs text-slate-600">{profile.label}</span>
          </span>
          <ChevronDown className="hidden size-4 text-slate-600 md:block" aria-hidden="true" />
        </span>
      }
      items={[
        {
          key: "sign-out",
          label: busy ? "Signing out…" : "Sign out",
          description: "End this session on this device",
          icon: <LogOut className="size-4 text-slate-700" aria-hidden="true" />,
          disabled: busy,
          onSelect: () => {
            setBusy(true);
            void signOut();
          },
        },
      ]}
    />
  );
}
