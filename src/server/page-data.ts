import "server-only";
import { notFound } from "next/navigation";
import { AppError } from "@/server/http/errors";

/** Server Components: turns a service-level 404 into the Next.js not-found page. */
export async function loadOrNotFound<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
