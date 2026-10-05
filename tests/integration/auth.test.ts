import { beforeAll, describe, expect, it } from "vitest";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { GET as meRoute } from "@/app/api/auth/me/route";
import { POST as approveRoute } from "@/app/api/verifications/[orderId]/approve/route";
import { DEMO_PASSWORD } from "@/lib/demo-accounts";
import { getPrisma } from "@/server/db";
import { call } from "../helpers/api";
import { personas, type Personas } from "../helpers/fixtures";

let people: Personas;

beforeAll(async () => {
  people = await personas();
});

describe("Authentication", () => {
  it("issues an HttpOnly, SameSite session cookie for valid credentials", async () => {
    const response = await call<{ user: { role: string }; redirectTo: string }>(loginRoute, {
      body: { email: "Verifier@ApparelFlow.demo ", password: DEMO_PASSWORD },
    });
    expect(response.status).toBe(200);
    expect(response.json.data.user.role).toBe("CUTTING_VERIFIER");
    expect(response.json.data.redirectTo).toBe("/verification");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/af_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(response.json.data).not.toHaveProperty("passwordHash");
  });

  it("returns the same 401 for a wrong password and an unknown account", async () => {
    const wrong = await call(loginRoute, { body: { email: "verifier@apparelflow.demo", password: "wrong-password" } });
    const unknown = await call(loginRoute, { body: { email: "nobody@apparelflow.demo", password: "wrong-password" } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.json.error).toEqual(unknown.json.error);
  });

  it("validates the login payload", async () => {
    expect((await call(loginRoute, { body: {} })).status).toBe(422);
    expect((await call(loginRoute, { body: { email: "not-an-email", password: "x" } })).status).toBe(422);
    expect((await call(loginRoute, { body: { email: "verifier@apparelflow.demo", password: DEMO_PASSWORD, role: "CUTTING_VERIFIER" } })).status).toBe(422);
  });

  it("derives identity from the session and rejects missing or tampered tokens", async () => {
    const me = await call<{ user: { id: string }; permissions: string[] }>(meRoute, { as: people.sewing });
    expect(me.status).toBe(200);
    expect(me.json.data.user.id).toBe(people.sewing.id);
    expect(me.json.data.permissions).toEqual(["recipe:read", "sewing:read", "sewing:start"]);

    expect((await call(meRoute)).status).toBe(401);
    expect((await call(meRoute, { cookie: "af_session=not.a.jwt" })).status).toBe(401);

    // A token signed with a different secret (e.g. forged role claim) is rejected.
    const forged =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQ1VUVElOR19WRVJJRklFUiIsInN1YiI6IjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMCIsImlzcyI6ImFwcGFyZWxmbG93LWVycCIsImF1ZCI6ImFwcGFyZWxmbG93LXdlYiJ9.c2lnbmF0dXJl";
    expect((await call(approveRoute, { method: "POST", cookie: `af_session=${forged}`, params: { orderId: people.supervisor.id } })).status).toBe(401);
  });

  it("invalidates sessions whose role no longer matches the database", async () => {
    const stale = { ...people.supervisor, role: "CUTTING_VERIFIER" as const };
    expect((await call(meRoute, { as: stale })).status).toBe(401);
  });

  it("clears the cookie on logout", async () => {
    const response = await call(logoutRoute, { method: "POST", as: people.supervisor });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/af_session=;.*Max-Age=0/i);
  });

  it("rejects cross-site state-changing requests", async () => {
    const response = await call(approveRoute, {
      method: "POST",
      as: people.verifier,
      params: { orderId: people.verifier.id },
      headers: { origin: "https://evil.example", host: "localhost:3000" },
    });
    expect(response.status).toBe(403);
    expect(await getPrisma().verificationLog.count()).toBe(0);
  });
});
