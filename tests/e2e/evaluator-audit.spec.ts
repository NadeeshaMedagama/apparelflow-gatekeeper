import { expect, test } from "@playwright/test";
import { DEMO, expectAccessible, signIn } from "./helpers";

/**
 * Mirrors the evaluator's 5-minute technical audit end to end:
 * create → shortage hard stop (UI + API) → mandatory-reason rejection →
 * re-cut → green approval → sewing hand-off → persistence across reloads.
 */
test.describe.configure({ mode: "serial" });

let orderNo = "";
let orderUrl = "";

test("demo persona panel signs in as a real Cutting Supervisor", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Demo personas" })).toBeVisible();
  await expectAccessible(page, "login page");

  await page.getByRole("button", { name: "Sign in as Cutting Supervisor" }).click();
  await expect(page).toHaveURL(/\/cutting$/);
  await expect(page.getByRole("heading", { name: "Cutting Orders", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "New cutting order" })).toBeVisible();
});

test("supervisor creates a batch; the multiplier engine derives every component count", async ({ page }) => {
  await signIn(page, DEMO.supervisor);
  await page.goto("/cutting");
  await expectAccessible(page, "cutting order board");

  await page.getByTestId("open-create-order").click();
  const dialog = page.getByRole("dialog", { name: "New cutting order" });

  // Defensive input guards: immediate inline errors.
  await dialog.getByLabel("Target batch quantity (garments)").fill("-5");
  await expect(dialog.getByText("Target batch quantity cannot be negative")).toBeVisible();
  await dialog.getByLabel("Target batch quantity (garments)").fill("1.5");
  await expect(dialog.getByText("Target batch quantity must be a whole number")).toBeVisible();
  await dialog.getByLabel("Target batch quantity (garments)").fill("abc");
  await expect(dialog.getByText("Target batch quantity must contain digits only")).toBeVisible();

  await dialog.getByLabel("Production recipe").selectOption({ label: "Casual Blouse — REC-BL01 (1.8 yd / garment)" });
  await dialog.getByLabel("Target batch quantity (garments)").fill("50");
  await dialog.getByLabel("Fabric roll ID").fill("fab-roll-882");
  await dialog.getByLabel("Actual fabric used (yards)").fill("92");

  const preview = dialog.getByRole("region", { name: "Multiplier engine" });
  await expect(preview.getByRole("row", { name: /Sleeve Cuffs/ })).toContainText("100");
  await expect(preview.getByRole("row", { name: /Total cut pieces/ })).toContainText("350");
  await expect(preview).toContainText("+2.22%");
  await expectAccessible(page, "create order dialog");

  await dialog.getByRole("button", { name: "Create & submit to QC" }).click();
  await expect(page).toHaveURL(/\/cutting\/orders\/[0-9a-f-]+$/);
  await expect(page.getByText("Pending verification").first()).toBeVisible();
  orderNo = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
  orderUrl = new URL(page.url()).pathname;
  expect(orderNo).toMatch(/^CUT-\d{4}-\d{4,}$/);
});

test("role isolation: verifier cannot create orders, sewing never sees the pending batch", async ({ page }) => {
  await signIn(page, DEMO.verifier);
  await page.goto("/verification");
  await expect(page.getByRole("button", { name: "New cutting order" })).toHaveCount(0);
  const forbidden = await page.goto("/cutting");
  expect(forbidden?.status()).toBe(403);
  await expect(page.getByText("This workspace is not available to your role")).toBeVisible();

  await signIn(page, DEMO.sewing);
  await page.goto("/sewing");
  await expect(page.getByRole("heading", { name: "Sewing Queue", level: 1 })).toBeVisible();
  await expect(page.getByText(orderNo)).toHaveCount(0);
  const api = await page.request.get(`/api/sewing/queue?status=PENDING_VERIFICATION`);
  const body = await api.json();
  expect(body.data.map((batch: { orderNo: string }) => batch.orderNo)).not.toContain(orderNo);
});

test("shortage hard stop: RED disables Approve and the API answers 422; rejection needs a reason", async ({ page }) => {
  await signIn(page, DEMO.verifier);
  await page.goto("/verification");
  await page.getByRole("row", { name: new RegExp(orderNo) }).getByRole("link", { name: "Open terminal" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Verification Terminal`) })).toBeVisible();

  const rows = page.locator('tr[data-testid^="count-row-"]');
  await expect(rows).toHaveCount(5);
  for (const name of ["Front Body Panel", "Back Body Panel", "Collar & Stand"]) {
    await page.getByLabel(name).fill("50");
  }
  await page.getByLabel("Sleeves (Left & Right)").fill("100");
  await page.getByLabel("Sleeve Cuffs").fill("98");

  await expect(page.getByTestId("count-row-Sleeve Cuffs")).toHaveAttribute("data-state", "RED");
  await expect(page.getByTestId("count-row-Sleeve Cuffs")).toContainText("Red · Shortage");
  await expect(page.getByTestId("approve-batch")).toBeDisabled();
  await expect(page.getByText("Approval blocked", { exact: true })).toBeVisible();
  await expectAccessible(page, "verifier terminal with a shortage");

  // Prove the backend hard stop from the UI…
  await page.getByTestId("probe-server-gate").click();
  await expect(page.getByTestId("probe-result")).toContainText("HTTP 422 · VERIFICATION_GATE_BLOCKED");
  await expect(page.getByTestId("probe-result")).toContainText("Sleeve Cuffs is short by 2");

  // …and directly, as an evaluator would with cURL.
  const orderId = orderUrl.split("/").pop();
  const direct = await page.request.post(`/api/verifications/${orderId}/approve`, { data: {} });
  expect(direct.status()).toBe(422);
  const asSupervisor = await page.context().request.post("/api/auth/login", { data: { email: DEMO.supervisor, password: DEMO.password } });
  expect(asSupervisor.ok()).toBeTruthy();
  const forbidden = await page.request.post(`/api/verifications/${orderId}/approve`, { data: {} });
  expect(forbidden.status()).toBe(403);
  await signIn(page, DEMO.verifier);
  await page.reload();

  // Mandatory rejection reason.
  await page.getByLabel("Sleeve Cuffs").fill("98");
  await page.getByTestId("reject-batch").click();
  const rejectDialog = page.getByRole("dialog", { name: new RegExp(`Reject ${orderNo}`) });
  await rejectDialog.getByRole("button", { name: "Reject batch" }).click();
  await expect(rejectDialog.getByText("A rejection reason is required")).toBeVisible();
  await rejectDialog.getByRole("button", { name: "Insert shortage summary" }).click();
  await expect(rejectDialog.getByLabel("Reason for rejection")).toHaveValue(/Sleeve Cuffs: counted 98 of 100/);
  await expectAccessible(page, "reject dialog");
  await rejectDialog.getByRole("button", { name: "Reject batch" }).click();

  await expect(page.getByText(/Count sheet locked — Rejected/)).toBeVisible();
});

test("supervisor sees the reason, re-cuts and resubmits", async ({ page }) => {
  await signIn(page, DEMO.supervisor);
  await page.goto(orderUrl);
  await expect(page.getByRole("alert").filter({ hasText: "Rejected in QC round 1" })).toContainText("Sleeve Cuffs: counted 98 of 100");

  await page.getByRole("button", { name: "Start re-cut" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start re-cut" }).click();
  await expect(page.getByText("Cutting in progress").first()).toBeVisible();

  await page.getByRole("button", { name: "Edit details" }).click();
  const edit = page.getByRole("dialog", { name: new RegExp(`Edit ${orderNo}`) });
  await edit.getByLabel("Actual fabric used (yards)").fill("93.40");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("93.40 yd").first()).toBeVisible();

  await page.getByRole("button", { name: "Submit for verification" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit to QC" }).click();
  await expect(page.getByText("QC round 2").first()).toBeVisible();
  await expect(page.getByText("Pending verification").first()).toBeVisible();
});

test("all-green batch is approved with the verifier's signature and server timestamp", async ({ page }) => {
  await signIn(page, DEMO.verifier);
  const orderId = orderUrl.split("/").pop();
  await page.goto(`/verification/${orderId}`);

  for (const name of ["Front Body Panel", "Back Body Panel", "Collar & Stand"]) {
    await page.getByLabel(name).fill("50");
  }
  await page.getByLabel("Sleeves (Left & Right)").fill("100");
  await page.getByLabel("Sleeve Cuffs").fill("100");
  await expect(page.getByText("Gate clear — ready to approve")).toBeVisible();
  await expect(page.getByTestId("approve-batch")).toBeEnabled();
  await expectAccessible(page, "verifier terminal ready to approve");

  await page.getByTestId("approve-batch").click();
  const dialog = page.getByRole("dialog", { name: new RegExp(`Approve ${orderNo}`) });
  await dialog.getByLabel("Note for the sewing floor (optional)").fill("Bundles tagged for line 2.");
  await dialog.getByRole("button", { name: "Approve & release" }).click();

  await expect(page.getByText(/Count sheet locked — Verified/)).toBeVisible();
  const record = page.getByRole("article", { name: "QC round 2 — approved" });
  await expect(record).toContainText("Amal Perera");
  await expect(record).toContainText("+3.78%");
});

test("sewing supervisor receives the verified batch, starts assembly, and it persists across reloads", async ({ page }) => {
  await signIn(page, DEMO.sewing);
  await page.goto("/sewing");
  const card = page.getByTestId(`sewing-batch-${orderNo}`);
  await expect(card).toContainText("Amal Perera");
  await expect(card).toContainText("+3.78%");
  await expect(card).toContainText("Bundles tagged for line 2.");
  await expectAccessible(page, "sewing queue");

  await card.getByRole("link", { name: "Review audit record" }).click();
  await expect(page.getByRole("article", { name: "QC round 2 — approved" })).toContainText("Sleeve Cuffs");
  await expectAccessible(page, "sewing batch audit record");

  await page.getByTestId(`start-sewing-${orderNo}`).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start assembly" }).click();
  await expect(page.getByText("On the assembly line", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Sewing in progress").first()).toBeVisible();
  await page.goto("/sewing?view=assembly");
  await expect(page.getByRole("row", { name: new RegExp(orderNo) })).toBeVisible();
});
