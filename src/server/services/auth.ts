import "server-only";
import type { LoginInput } from "@/domain/validation";
import type { AuthUser } from "@/server/auth/current-user";
import { equalizeLoginTiming, verifyPassword } from "@/server/auth/password";
import { getPrisma } from "@/server/db";
import { AppError } from "@/server/http/errors";

const INVALID_CREDENTIALS = "Invalid email or password.";

/**
 * Verifies credentials against the bcrypt hash. Unknown emails and wrong
 * passwords produce the same error and take the same time, so the endpoint
 * cannot be used to discover which accounts exist.
 */
export async function authenticateCredentials(input: LoginInput): Promise<AuthUser> {
  const user = await getPrisma().user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, fullName: true, role: true, passwordHash: true },
  });

  if (!user) {
    await equalizeLoginTiming(input.password);
    throw new AppError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS);
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS);
  }

  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}
