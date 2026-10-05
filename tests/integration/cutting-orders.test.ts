import { beforeAll, describe, expect, it } from "vitest";
import { GET as listRoute, POST as createRoute } from "@/app/api/cutting-orders/route";
import { GET as detailRoute, PATCH as updateRoute } from "@/app/api/cutting-orders/[id]/route";
import { POST as recutRoute } from "@/app/api/cutting-orders/[id]/recut/route";
import { POST as submitRoute } from "@/app/api/cutting-orders/[id]/submit/route";
import type { CuttingOrderDetailDTO, CuttingOrderSummaryDTO } from "@/lib/dto";
import { getPrisma } from "@/server/db";
import { saveComponentCounts, approveBatch } from "@/server/services/verification";
import { call } from "../helpers/api";
import { counts, pendingOrder, personas, recipeId, rejectedOrder, type Personas } from "../helpers/fixtures";

let people: Personas;
let blouseId: string;

beforeAll(async () => {
  people = await personas();
  blouseId = await recipeId("REC-BL01");
});

const validBody = () => ({ recipeId: blouseId, targetQty: 50, fabricRollId: "FAB-ROLL-882", actualFabricYds: 92.5 });

describe("Cutting order creation & multiplier engine", () => {
  it("creates an order in CUTTING_IN_PROGRESS with recipe-derived expected component counts", async () => {
    const response = await call<CuttingOrderDetailDTO>(createRoute, { as: people.supervisor, body: validBody() });

    expect(response.status).toBe(201);
    const order = response.json.data;
    expect(order.orderNo).toMatch(/^CUT-\d{4}-\d{4,}$/);
    expect(order.status).toBe("CUTTING_IN_PROGRESS");
    expect(order.createdBy.id).toBe(people.supervisor.id);
    expect(Object.fromEntries(order.expectedComponents.map((component) => [component.componentName, component.expectedQty]))).toEqual({
      "Front Body Panel": 50,
      "Back Body Panel": 50,
      "Sleeves (Left & Right)": 100,
      "Collar & Stand": 50,
      "Sleeve Cuffs": 100,
    });
    expect(order.expectedFabricYds).toBe(90);
    expect(order.projectedWastage.wastagePct).toBe(2.78);
    expect(order.verificationItems).toHaveLength(0);
    expect(order.events.map((event) => event.toStatus)).toEqual(["CUTTING_IN_PROGRESS"]);
  });

  it("can create and submit in one step, issuing a count sheet for the QC station", async () => {
    const response = await call<CuttingOrderDetailDTO>(createRoute, {
      as: people.supervisor,
      body: { ...validBody(), submitForVerification: true },
    });
    expect(response.status).toBe(201);
    const order = response.json.data;
    expect(order.status).toBe("PENDING_VERIFICATION");
    expect(order.verificationRound).toBe(1);
    expect(order.verificationItems.map((item) => [item.componentName, item.expectedQty, item.actualQty])).toEqual([
      ["Front Body Panel", 50, null],
      ["Back Body Panel", 50, null],
      ["Sleeves (Left & Right)", 100, null],
      ["Collar & Stand", 50, null],
      ["Sleeve Cuffs", 100, null],
    ]);
  });

  it("normalises the fabric roll id to upper case", async () => {
    const response = await call<CuttingOrderDetailDTO>(createRoute, {
      as: people.supervisor,
      body: { ...validBody(), fabricRollId: "  fab-roll-901 " },
    });
    expect(response.status).toBe(201);
    expect(response.json.data.fabricRollId).toBe("FAB-ROLL-901");
  });

  it.each([
    ["negative quantity", { targetQty: -5 }, "targetQty"],
    ["zero quantity", { targetQty: 0 }, "targetQty"],
    ["decimal quantity", { targetQty: 10.5 }, "targetQty"],
    ["numeric string quantity", { targetQty: "50" }, "targetQty"],
    ["non-numeric quantity", { targetQty: "abc" }, "targetQty"],
    ["null quantity", { targetQty: null }, "targetQty"],
    ["quantity above the plant limit", { targetQty: 50_001 }, "targetQty"],
    ["negative fabric", { actualFabricYds: -1 }, "actualFabricYds"],
    ["zero fabric", { actualFabricYds: 0 }, "actualFabricYds"],
    ["fabric with 3 decimals", { actualFabricYds: 92.555 }, "actualFabricYds"],
    ["fabric as text", { actualFabricYds: "92" }, "actualFabricYds"],
    ["blank fabric roll", { fabricRollId: "   " }, "fabricRollId"],
    ["fabric roll with symbols", { fabricRollId: "ROLL#1!" }, "fabricRollId"],
    ["malformed recipe id", { recipeId: "REC-BL01" }, "recipeId"],
  ])("rejects %s with 422 and a field error", async (_label, override, field) => {
    const response = await call(createRoute, { as: people.supervisor, body: { ...validBody(), ...override } });
    expect(response.status).toBe(422);
    expect(response.json.error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys((response.json.error.details?.fieldErrors ?? {}) as object)).toContain(field);
  });

  it("rejects missing fields, empty bodies, malformed JSON and smuggled status fields", async () => {
    expect((await call(createRoute, { as: people.supervisor, body: {} })).status).toBe(422);
    expect((await call(createRoute, { as: people.supervisor, method: "POST", rawBody: "" })).status).toBe(422);
    expect((await call(createRoute, { as: people.supervisor, method: "POST", rawBody: "{not json" })).status).toBe(400);
    expect((await call(createRoute, { as: people.supervisor, body: [] })).status).toBe(422);
    const smuggled = await call(createRoute, { as: people.supervisor, body: { ...validBody(), status: "VERIFIED" } });
    expect(smuggled.status).toBe(422);
    expect(smuggled.json.error.message).toMatch(/status/);
  });

  it("rejects an unknown recipe", async () => {
    const response = await call(createRoute, {
      as: people.supervisor,
      body: { ...validBody(), recipeId: "00000000-0000-4000-8000-000000000000" },
    });
    expect(response.status).toBe(422);
    expect(response.json.error.code).toBe("UNKNOWN_RECIPE");
  });

  it("only lets the Cutting Supervisor create or list orders", async () => {
    for (const intruder of [people.verifier, people.sewing]) {
      expect((await call(createRoute, { as: intruder, body: validBody() })).status).toBe(403);
      expect((await call(listRoute, { as: intruder })).status).toBe(403);
    }
    expect((await call(createRoute, { body: validBody() })).status).toBe(401);
  });
});

describe("Order board & state transitions", () => {
  it("filters the board by a validated status", async () => {
    await pendingOrder(people);
    const response = await call<CuttingOrderSummaryDTO[]>(listRoute, {
      as: people.supervisor,
      path: "/api/cutting-orders?status=PENDING_VERIFICATION",
    });
    expect(response.status).toBe(200);
    expect(response.json.data.length).toBeGreaterThan(0);
    expect(response.json.data.every((order) => order.status === "PENDING_VERIFICATION")).toBe(true);

    const bogus = await call(listRoute, { as: people.supervisor, path: "/api/cutting-orders?status=HACKED" });
    expect(bogus.status).toBe(422);
  });

  it("allows edits only while cutting is in progress, and never accepts a status", async () => {
    const draft = (await call<CuttingOrderDetailDTO>(createRoute, { as: people.supervisor, body: validBody() })).json.data;

    const edit = await call<CuttingOrderDetailDTO>(updateRoute, {
      method: "PATCH",
      as: people.supervisor,
      body: { actualFabricYds: 95, targetQty: 52 },
      params: { id: draft.id },
    });
    expect(edit.status).toBe(200);
    expect(edit.json.data.targetQty).toBe(52);
    expect(edit.json.data.events.at(-1)?.note).toContain("target 50 → 52 garments");

    const statusEdit = await call(updateRoute, { method: "PATCH", as: people.supervisor, body: { status: "VERIFIED" }, params: { id: draft.id } });
    expect(statusEdit.status).toBe(422);
    const emptyEdit = await call(updateRoute, { method: "PATCH", as: people.supervisor, body: {}, params: { id: draft.id } });
    expect(emptyEdit.status).toBe(422);

    const pending = await pendingOrder(people);
    const locked = await call(updateRoute, { method: "PATCH", as: people.supervisor, body: { targetQty: 10 }, params: { id: pending.id } });
    expect(locked.status).toBe(409);
    expect(locked.json.error.code).toBe("ORDER_LOCKED");
  });

  it("refuses to submit a batch twice or straight from REJECTED", async () => {
    const pending = await pendingOrder(people);
    const twice = await call(submitRoute, { method: "POST", as: people.supervisor, params: { id: pending.id } });
    expect(twice.status).toBe(409);

    const rejected = await rejectedOrder(people);
    const direct = await call(submitRoute, { method: "POST", as: people.supervisor, params: { id: rejected.id } });
    expect(direct.status).toBe(409);
  });

  it("runs the full re-cut loop: rejected → re-cut → resubmitted with a fresh sheet → verified in round 2", async () => {
    const order = await rejectedOrder(people);

    const recut = await call<CuttingOrderDetailDTO>(recutRoute, { method: "POST", as: people.supervisor, params: { id: order.id } });
    expect(recut.status).toBe(200);
    expect(recut.json.data.status).toBe("CUTTING_IN_PROGRESS");

    await call(updateRoute, { method: "PATCH", as: people.supervisor, body: { actualFabricYds: 94 }, params: { id: order.id } });
    const resubmitted = await call<CuttingOrderDetailDTO>(submitRoute, { method: "POST", as: people.supervisor, params: { id: order.id } });
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.json.data.verificationRound).toBe(2);
    expect(resubmitted.json.data.verificationItems.every((item) => item.actualQty === null)).toBe(true);

    await saveComponentCounts(people.verifier, order.id, counts(resubmitted.json.data));
    const approved = await approveBatch(people.verifier, order.id, {});
    expect(approved.log.round).toBe(2);

    const detail = await call<CuttingOrderDetailDTO>(detailRoute, { as: people.supervisor, params: { id: order.id } });
    expect(detail.json.data.verificationLogs.map((log) => [log.round, log.decision])).toEqual([
      [2, "APPROVED"],
      [1, "REJECTED"],
    ]);
    expect(detail.json.data.events.map((event) => event.toStatus)).toEqual([
      "CUTTING_IN_PROGRESS",
      "PENDING_VERIFICATION",
      "REJECTED",
      "CUTTING_IN_PROGRESS",
      "CUTTING_IN_PROGRESS",
      "PENDING_VERIFICATION",
      "VERIFIED",
    ]);
    // Round-1 counts survive in the immutable rejection snapshot.
    const round1 = detail.json.data.verificationLogs.find((log) => log.round === 1);
    expect(round1?.items.find((item) => item.componentName === "Sleeve Cuffs")).toMatchObject({ actualQty: 90, status: "RED" });
  });

  it("does not let other roles drive cutting transitions", async () => {
    const rejected = await rejectedOrder(people);
    for (const intruder of [people.verifier, people.sewing]) {
      expect((await call(recutRoute, { method: "POST", as: intruder, params: { id: rejected.id } })).status).toBe(403);
      expect((await call(submitRoute, { method: "POST", as: intruder, params: { id: rejected.id } })).status).toBe(403);
    }
    const stored = await getPrisma().cuttingOrder.findUniqueOrThrow({ where: { id: rejected.id } });
    expect(stored.status).toBe("REJECTED");
  });
});
