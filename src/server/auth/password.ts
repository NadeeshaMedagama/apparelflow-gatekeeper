import "server-only";
import bcrypt from "bcryptjs";

const BCRYPT_COST = 10;

let dummyHash: Promise<string> | null = null;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

/**
 * Burns the same bcrypt time as a real comparison when the email is unknown,
 * so response timing does not reveal which accounts exist.
 */
export async function equalizeLoginTiming(password: string): Promise<void> {
  dummyHash ??= bcrypt.hash(crypto.randomUUID(), BCRYPT_COST);
  await bcrypt.compare(password, await dummyHash);
}
