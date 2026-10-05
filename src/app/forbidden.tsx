import { ShieldX } from "lucide-react";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { ROLE_PROFILES } from "@/domain/roles";
import { getCurrentUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Access restricted" };

/** Rendered with HTTP 403 whenever a page calls forbidden(). */
export default async function Forbidden() {
  const user = await getCurrentUser();
  const profile = user ? ROLE_PROFILES[user.role] : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <div className="flex justify-center">
          <Logo />
        </div>
        <span className="mx-auto mt-8 flex size-14 items-center justify-center rounded-full bg-red-50 text-red-700">
          <ShieldX className="size-7" aria-hidden="true" />
        </span>
        <p className="mt-5 text-sm font-semibold tracking-wide text-red-700 uppercase">403 · Access restricted</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">This workspace is not available to your role</h1>
        <p className="mt-3 text-[15px] text-slate-600">
          {profile ? (
            <>
              You are signed in as <strong className="text-slate-900">{profile.label}</strong> (
              <code className="font-mono text-sm">{profile.code}</code>). {profile.restriction}
            </>
          ) : (
            "Sign in with an account that holds the required role."
          )}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          {profile ? (
            <ButtonLink href={profile.home} variant="primary">
              Go to my workspace
            </ButtonLink>
          ) : null}
          <ButtonLink href="/login" variant="secondary">
            Switch account
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
