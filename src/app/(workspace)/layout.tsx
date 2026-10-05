import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requirePageUser } from "@/server/auth/page-guards";

/** Authenticated workspace chrome. Each page additionally enforces its own permission. */
export default async function WorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await requirePageUser();
  return <AppShell user={user}>{children}</AppShell>;
}
