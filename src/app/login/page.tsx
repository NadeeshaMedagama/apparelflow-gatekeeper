import { Fingerprint, ScrollText, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { DemoPersonas } from "@/components/auth/demo-personas";
import { Logo } from "@/components/brand/logo";
import { PipelineDiagram } from "@/components/auth/pipeline-diagram";
import { ROLE_PROFILES } from "@/domain/roles";
import { getCurrentUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_PROFILES[user.role].home);

  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-navy-900 px-10 py-10 text-white lg:flex lg:flex-col xl:px-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <Logo inverted />
        </div>
        <div className="relative mt-auto mb-auto max-w-xl py-10">
          <p className="text-sm font-semibold tracking-wide text-blue-300 uppercase">Production batch verification</p>
          <h1 className="mt-3 text-4xl leading-tight font-bold tracking-tight">
            Cutting Operations &amp; Gatekeeper Verification Terminal
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            No unverified, mismatched or short batch reaches the sewing floor. Every component is counted, every
            approval is signed by an authorised verifier, and the server enforces the gate.
          </p>
          <div className="mt-8">
            <PipelineDiagram />
          </div>
          <ul className="mt-8 grid gap-4 text-sm sm:grid-cols-3">
            <li className="flex gap-2.5">
              <ShieldCheck className="size-5 shrink-0 text-blue-300" aria-hidden="true" />
              <span className="text-slate-200">Server-enforced hard stop</span>
            </li>
            <li className="flex gap-2.5">
              <Fingerprint className="size-5 shrink-0 text-blue-300" aria-hidden="true" />
              <span className="text-slate-200">Role-isolated workspaces</span>
            </li>
            <li className="flex gap-2.5">
              <ScrollText className="size-5 shrink-0 text-blue-300" aria-hidden="true" />
              <span className="text-slate-200">Immutable audit trail</span>
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-slate-400">© ApparelFlow ERP · Assessment build</p>
      </aside>

      <main className="flex items-start justify-center bg-canvas px-4 py-8 sm:px-8 lg:items-center lg:py-12">
        <div className="w-full max-w-xl">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-600">Use your factory account, or pick a demo persona below.</p>
            <div className="mt-6">
              <LoginForm nextPath={nextPath} />
            </div>
          </div>
          <div className="mt-6">
            <DemoPersonas />
          </div>
        </div>
      </main>
    </div>
  );
}
