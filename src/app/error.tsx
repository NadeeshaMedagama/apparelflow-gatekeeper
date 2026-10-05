"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          <TriangleAlert className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-[15px] text-slate-600">
          The page could not be loaded. No production data was changed.
          {error.digest ? <span className="mt-1 block font-mono text-xs text-slate-600">Reference: {error.digest}</span> : null}
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={reset} icon={<RotateCcw className="size-4" aria-hidden="true" />}>
            Try again
          </Button>
        </div>
      </div>
    </main>
  );
}
