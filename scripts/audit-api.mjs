#!/usr/bin/env node
/**
 * ApparelFlow Gatekeeper Audit — the brief's server-side security checks run
 * against a live deployment, exactly as an evaluator would with Postman/cURL.
 *
 *   node scripts/audit-api.mjs [base-url] [--mode=read-only|full]
 *
 *   read-only (default)  Only checks that never create or change data, so it is
 *                        safe to run against production (used after every deploy).
 *   full                 Also creates a demo batch and drives it through shortage →
 *                        rejection → re-cut → approval → sewing queue.
 *
 * Optional environment variables (also set by the root action.yml):
 *   AUDIT_BASE_URL, AUDIT_MODE, AUDIT_WAIT_SECONDS, AUDIT_PASSWORD,
 *   AUDIT_SUPERVISOR_EMAIL, AUDIT_VERIFIER_EMAIL, AUDIT_SEWING_EMAIL
 *
 * Inside GitHub Actions it also writes a Markdown report to the job summary and
 * `passed` / `failed` / `skipped` step outputs. Requires Node.js 20+.
 * Exit code: 0 when every executed check passed, 1 otherwise.
 */
import { appendFileSync } from "node:fs";

const args = process.argv.slice(2);
const positional = args.filter((arg) => !arg.startsWith("--"));
const flag = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const BASE = (positional[0] ?? process.env.AUDIT_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const MODE = (flag("mode") ?? process.env.AUDIT_MODE ?? "read-only").trim().toLowerCase();
const WAIT_SECONDS = Number.parseInt(flag("wait") ?? process.env.AUDIT_WAIT_SECONDS ?? "0", 10) || 0;
const PASSWORD = process.env.AUDIT_PASSWORD || "ApparelFlow@2026";
const ACCOUNTS = {
  supervisor: process.env.AUDIT_SUPERVISOR_EMAIL || "supervisor@apparelflow.demo",
  verifier: process.env.AUDIT_VERIFIER_EMAIL || "verifier@apparelflow.demo",
  sewing: process.env.AUDIT_SEWING_EMAIL || "sewing@apparelflow.demo",
};
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const REQUEST_TIMEOUT_MS = 20_000;

if (!["read-only", "full"].includes(MODE)) {
  console.error(`Unknown mode "${MODE}". Use --mode=read-only or --mode=full.`);
  process.exit(2);
}
try {
  new URL(BASE);
} catch {
  console.error(`Invalid base URL "${BASE}".`);
  process.exit(2);
}

/** @type {Array<{ section: string; label: string; status: "pass" | "fail" | "skip"; detail: string }>} */
const results = [];
let section = "";
const cookies = {};

function heading(title) {
  section = title;
  console.log(`\n${title}`);
}

function check(label, condition, detail = "") {
  const status = condition ? "pass" : "fail";
  results.push({ section, label, status, detail: condition ? "" : detail });
  console.log(`  ${condition ? "✓ PASS" : "✗ FAIL"}  ${label}${!condition && detail ? `  (${detail})` : ""}`);
  return condition;
}

function skip(label, reason) {
  results.push({ section, label, status: "skip", detail: reason });
  console.log(`  - SKIP  ${label}  (${reason})`);
}

async function request(method, path, { as, body } = {}) {
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (as) headers.cookie = cookies[as] ?? "";
  try {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    let json = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    return { status: response.status, json, headers: response.headers };
  } catch (error) {
    return { status: 0, json: null, headers: new Headers(), error: error instanceof Error ? error.message : String(error) };
  }
}

const got = (response) => (response.status === 0 ? `network error: ${response.error}` : `got HTTP ${response.status}`);

async function waitForHealth() {
  const deadline = Date.now() + WAIT_SECONDS * 1000;
  let response = await request("GET", "/api/health");
  while (!(response.status === 200 && response.json?.data?.database === "up") && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    response = await request("GET", "/api/health");
  }
  return response;
}

async function login(role) {
  const response = await request("POST", "/api/auth/login", { body: { email: ACCOUNTS[role], password: PASSWORD } });
  const setCookie = response.headers.get("set-cookie") ?? "";
  cookies[role] = setCookie.split(";")[0];
  return response;
}

async function readOnlyChecks() {
  heading("Health & authentication");
  const health = await waitForHealth();
  if (!check("GET /api/health → 200 with the database up", health.status === 200 && health.json?.data?.database === "up", got(health))) {
    return false;
  }
  for (const role of Object.keys(ACCOUNTS)) {
    const response = await login(role);
    check(`login as ${role} → 200 + HttpOnly session cookie`, response.status === 200 && cookies[role]?.startsWith("af_session="), got(response));
  }
  const anonymous = await request("GET", "/api/cutting-orders");
  check("unauthenticated GET /api/cutting-orders → 401", anonymous.status === 401, got(anonymous));
  const badPassword = await request("POST", "/api/auth/login", { body: { email: ACCOUNTS.verifier, password: `${PASSWORD}-wrong` } });
  check("wrong password → 401", badPassword.status === 401, got(badPassword));

  heading("Input guards (rejected before anything is written)");
  const recipes = await request("GET", "/api/recipes", { as: "supervisor" });
  const blouse = recipes.json?.data?.find((recipe) => recipe.recipeCode === "REC-BL01") ?? recipes.json?.data?.[0];
  check("production recipes are available", recipes.status === 200 && Boolean(blouse), got(recipes));
  const recipeId = blouse?.id ?? UNKNOWN_ID;
  for (const [label, targetQty] of [["negative", -5], ["decimal", 1.5], ["text", "abc"], ["null", null]]) {
    const response = await request("POST", "/api/cutting-orders", {
      as: "supervisor",
      body: { recipeId, targetQty, fabricRollId: "FAB-AUDIT-1", actualFabricYds: 10 },
    });
    check(`${label} batch quantity → 422`, response.status === 422, got(response));
  }
  const smuggled = await request("POST", "/api/cutting-orders", {
    as: "supervisor",
    body: { recipeId, targetQty: 5, fabricRollId: "FAB-AUDIT-1", actualFabricYds: 10, status: "VERIFIED" },
  });
  check("client-supplied status field → 422", smuggled.status === 422, got(smuggled));

  // A pending batch whose gate is closed lets us probe the hard stop without changing anything.
  const pending = await request("GET", "/api/verifications/pending", { as: "verifier" });
  let blockedOrderId = null;
  for (const order of pending.json?.data ?? []) {
    const sheet = await request("GET", `/api/verifications/${order.id}`, { as: "verifier" });
    if (sheet.status === 200 && sheet.json?.data?.gate?.passed === false) {
      blockedOrderId = order.id;
      break;
    }
  }
  const probeId = blockedOrderId ?? UNKNOWN_ID;

  heading("Role isolation (403)");
  const supApprove = await request("POST", `/api/verifications/${probeId}/approve`, { as: "supervisor" });
  check("Cutting Supervisor approving → 403", supApprove.status === 403, got(supApprove));
  const sewApprove = await request("POST", `/api/verifications/${probeId}/approve`, { as: "sewing" });
  check("Sewing Supervisor approving → 403", sewApprove.status === 403, got(sewApprove));
  const verCreate = await request("POST", "/api/cutting-orders", { as: "verifier", body: {} });
  check("Cutting Verifier creating an order → 403", verCreate.status === 403, got(verCreate));
  const supSewing = await request("GET", "/api/sewing/queue", { as: "supervisor" });
  check("Cutting Supervisor reading the Sewing Queue → 403", supSewing.status === 403, got(supSewing));
  const verSewing = await request("GET", "/api/sewing/queue", { as: "verifier" });
  check("Cutting Verifier reading the Sewing Queue → 403", verSewing.status === 403, got(verSewing));

  heading("Gatekeeper hard stop (422)");
  if (blockedOrderId) {
    const blocked = await request("POST", `/api/verifications/${blockedOrderId}/approve`, { as: "verifier" });
    check(
      "approving a pending batch with red / uncounted components → 422 VERIFICATION_GATE_BLOCKED",
      blocked.status === 422 && blocked.json?.error?.code === "VERIFICATION_GATE_BLOCKED",
      got(blocked),
    );
  } else {
    skip("approving a short / uncounted batch → 422", "no pending batch with a closed gate on the target");
  }
  const forged = await request("POST", `/api/verifications/${probeId}/approve`, {
    as: "verifier",
    body: { verifierId: UNKNOWN_ID },
  });
  check("forged verifierId in the body → 422 (identity comes from the session)", forged.status === 422, got(forged));
  const noReason = await request("POST", `/api/verifications/${probeId}/reject`, { as: "verifier", body: {} });
  check("reject without a reason → 422", noReason.status === 422, got(noReason));

  heading("Sewing Queue isolation");
  for (const path of ["/api/sewing/queue", "/api/sewing/queue?status=PENDING_VERIFICATION"]) {
    const queue = await request("GET", path, { as: "sewing" });
    const leaked = (queue.json?.data ?? []).some((batch) => batch.status !== "VERIFIED" || batch.id === blockedOrderId);
    check(`GET ${path} lists VERIFIED batches only`, queue.status === 200 && !leaked, leaked ? "unverified batch leaked" : got(queue));
  }
  if (blockedOrderId) {
    const hidden = await request("GET", `/api/sewing/queue/${blockedOrderId}`, { as: "sewing" });
    check("Sewing Supervisor reading a pending batch directly → 404", hidden.status === 404, got(hidden));
  } else {
    skip("Sewing Supervisor reading a pending batch directly → 404", "no pending batch on the target");
  }
  return true;
}

async function lifecycleChecks() {
  heading("Full lifecycle (creates a demo batch)");
  const recipes = await request("GET", "/api/recipes", { as: "supervisor" });
  const blouse = recipes.json?.data?.find((recipe) => recipe.recipeCode === "REC-BL01");
  if (!check("recipe REC-BL01 (Casual Blouse) is seeded", Boolean(blouse), got(recipes))) return;

  const order = await request("POST", "/api/cutting-orders", {
    as: "supervisor",
    body: { recipeId: blouse.id, targetQty: 50, fabricRollId: "FAB-ROLL-AUDIT", actualFabricYds: 92, submitForVerification: true },
  });
  if (!check("create & submit 50 × Casual Blouse → 201 PENDING_VERIFICATION", order.status === 201 && order.json?.data?.status === "PENDING_VERIFICATION", got(order))) {
    return;
  }
  const orderId = order.json.data.id;
  const items = order.json.data.verificationItems ?? [];
  const cuffs = items.find((item) => item.componentName === "Sleeve Cuffs");
  check("multiplier engine: 50 garments × 2 cuffs = 100 expected", cuffs?.expectedQty === 100, `got ${cuffs?.expectedQty}`);

  const shortage = items.map((item) => ({ componentId: item.componentId, actualQty: item.componentName === "Sleeve Cuffs" ? 98 : item.expectedQty }));
  const saved = await request("PUT", `/api/verifications/${orderId}/items`, { as: "verifier", body: { items: shortage } });
  const savedCuffs = saved.json?.data?.items?.find((item) => item.componentName === "Sleeve Cuffs");
  check("counts saved; the server derives RED for 98 of 100 cuffs", saved.status === 200 && savedCuffs?.status === "RED", got(saved));
  const blocked = await request("POST", `/api/verifications/${orderId}/approve`, { as: "verifier" });
  check("approving with a RED component → 422 VERIFICATION_GATE_BLOCKED", blocked.status === 422 && blocked.json?.error?.code === "VERIFICATION_GATE_BLOCKED", got(blocked));
  const queueBefore = await request("GET", "/api/sewing/queue", { as: "sewing" });
  check("the short batch is absent from the Sewing Queue", !(queueBefore.json?.data ?? []).some((batch) => batch.id === orderId), got(queueBefore));

  const rejected = await request("POST", `/api/verifications/${orderId}/reject`, {
    as: "verifier",
    body: { reason: "Sleeve Cuffs short by 2 pieces (98 of 100) — gatekeeper audit." },
  });
  check("reject with a reason → 200 REJECTED", rejected.status === 200 && rejected.json?.data?.order?.status === "REJECTED", got(rejected));
  const recut = await request("POST", `/api/cutting-orders/${orderId}/recut`, { as: "supervisor" });
  const resubmit = await request("POST", `/api/cutting-orders/${orderId}/submit`, { as: "supervisor" });
  check("re-cut + resubmit → PENDING_VERIFICATION, QC round 2", recut.status === 200 && resubmit.json?.data?.verificationRound === 2, `${got(recut)} / ${got(resubmit)}`);

  const fresh = resubmit.json?.data?.verificationItems ?? [];
  await request("PUT", `/api/verifications/${orderId}/items`, {
    as: "verifier",
    body: { items: fresh.map((item) => ({ componentId: item.componentId, actualQty: item.expectedQty })) },
  });
  const approved = await request("POST", `/api/verifications/${orderId}/approve`, { as: "verifier" });
  check(
    "all GREEN → 200 VERIFIED, attributed to the session's verifier",
    approved.status === 200 && approved.json?.data?.log?.verifier?.email === ACCOUNTS.verifier,
    got(approved),
  );
  const queueAfter = await request("GET", "/api/sewing/queue", { as: "sewing" });
  check("the verified batch is now in the Sewing Queue", (queueAfter.json?.data ?? []).some((batch) => batch.id === orderId), got(queueAfter));
}

function writeGitHubReport(passed, failed, skipped) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `passed=${passed}\nfailed=${failed}\nskipped=${skipped}\n`);
  }
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const icon = { pass: "✅", fail: "❌", skip: "⏭️" };
  const escape = (text) => String(text).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  const rows = results.map((result) => `| ${icon[result.status]} | ${escape(result.section)} | ${escape(result.label)} | ${escape(result.detail)} |`);
  const verdict = failed === 0 ? "✅ All executed checks passed" : `❌ ${failed} check(s) failed`;
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      "## ApparelFlow Gatekeeper Audit",
      "",
      `**Target:** ${BASE} · **Mode:** \`${MODE}\` · **Result:** ${verdict} (${passed} passed, ${failed} failed, ${skipped} skipped)`,
      "",
      "| | Area | Check | Detail |",
      "| --- | --- | --- | --- |",
      ...rows,
      "",
    ].join("\n"),
  );
}

async function main() {
  console.log(`\nApparelFlow Gatekeeper Audit → ${BASE} (mode: ${MODE})`);
  const healthy = await readOnlyChecks();
  if (healthy && MODE === "full") await lifecycleChecks();

  const passed = results.filter((result) => result.status === "pass").length;
  const failed = results.filter((result) => result.status === "fail").length;
  const skipped = results.filter((result) => result.status === "skip").length;
  console.log(`\n${failed === 0 ? "All executed checks passed" : `${failed} check(s) failed`} — ${passed} passed, ${failed} failed, ${skipped} skipped.\n`);
  writeGitHubReport(passed, failed, skipped);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
