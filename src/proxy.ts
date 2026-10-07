import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth/session";

/**
 * Coarse navigation guard: visitors without a valid session token are sent to
 * the login page before any workspace renders.
 *
 * This is a UX convenience, not the security boundary. Every Route Handler
 * and every Server Component re-authenticates against the database and checks
 * the role's permissions itself (see src/server/auth/current-user.ts), so a
 * bypassed or misconfigured proxy cannot expose data.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const claims = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!claims) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: API routes authenticate themselves and answer with JSON 401s.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|components/|robots.txt).*)"],
};
