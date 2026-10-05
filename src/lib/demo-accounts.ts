import type { Role } from "@/domain/roles";

/**
 * Demo personas for evaluation. These are real accounts in the database
 * (bcrypt-hashed by the seed script); the login panel and the role switcher
 * authenticate with them through the normal login endpoint.
 */
export const DEMO_PASSWORD = "ApparelFlow@2026";

export interface DemoAccount {
  role: Role;
  email: string;
  fullName: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { role: "CUTTING_SUPERVISOR", email: "supervisor@apparelflow.demo", fullName: "Nimal Fernando" },
  { role: "CUTTING_VERIFIER", email: "verifier@apparelflow.demo", fullName: "Amal Perera" },
  { role: "SEWING_SUPERVISOR", email: "sewing@apparelflow.demo", fullName: "Dilani Jayawardena" },
];
