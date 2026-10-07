import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <div className="flex justify-center">
          <Logo />
        </div>
        <span className="mx-auto mt-8 flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-700">
          <SearchX className="size-7" aria-hidden="true" />
        </span>
        <p className="mt-5 text-sm font-semibold tracking-wide text-slate-600 uppercase">404 · Not found</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">We couldn’t find that page</h1>
        <p className="mt-3 text-[15px] text-slate-600">
          The batch or page may not exist, or it is not visible to your role.
        </p>
        <div className="mt-7 flex justify-center">
          <ButtonLink href="/" variant="primary">
            Back to my workspace
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
