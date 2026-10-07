import { redirect } from "next/navigation";
import { ROLE_PROFILES } from "@/domain/roles";
import { getCurrentUser } from "@/server/auth/current-user";

/** Entry point: route each persona to its own workspace. */
export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? ROLE_PROFILES[user.role].home : "/login");
}
