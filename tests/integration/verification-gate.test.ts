import { beforeAll, describe, expect, it } from "vitest";
import { POST as approveRoute } from "@/app/api/verifications/[orderId]/approve/route";
import { PUT as countsRoute } from "@/app/api/verifications/[orderId]/items/route";
import { POST as rejectRoute } from "@/app/api/verifications/[orderId]/reject/route";
import { GET as sewingQueueRoute } from "@/app/api/sewing/queue/route";
import { GET as sewingBatchRoute } from "@/app/api/sewing/queue/[orderId]/route";
import type { DecisionResultDTO } from "@/server/services/verification";
import type { SewingBatchDTO } from "@/lib/dto";
import { getPrisma } from "@/server/db";
import { createCuttingOrder } from "@/server/services/cutting-orders";
import { getSewingQueue } from "@/server/services/sewing";
import { saveComponentCounts } from "@/server/services/verification";
import { call } from "../helpers/api";
import { counts, pendingOrder, personas, recipeId, rejectedOrder, verifiedOrder, type Personas } from "../helpers/fixtures";

let people: Personas;

beforeAll(async () => {
  people = await personas();
});

async function approve(orderId: string, as = people.verifier, body?: unknown) {
  return call<DecisionResultDTO>(approveRoute, { method: "POST", as, body, params: { orderId } });
}

describe("Gatekeeper hard stop — required assessment tests", () => {
  it("Test 1: an order with all GREEN components can be approved by an authenticated Verifier", async () => {
    const order = await pendingOrder(people, { targetQty: 50, actualFabricYds: 92 });
    await saveComponentCounts(people.verifier, order.id, counts(order));

    const response = await approve(order.id);

    expect(response.status).toBe(200);
    expect(response.json.data.order.status).toBe("VERIFIED");
    const log = response.json.data.log;
    expect(log.decision).toBe("APPROVED");
    // Attribution comes from the session, the timestamp from the server.
    expect(log.verifier.id).toBe(people.verifier.id);
    expect(Date.now() - new Date(log.timestamp).getTime()).toBeLessThan(60_000);
    // Wastage = ((92 − 50 × 1.8) ÷ 90) × 100 = 2.22 %
    expect(log.wastagePct).toBe(2.22);
    expect(log.items).toHaveLength(5);
    expect(log.items.every((item) => item.status === "GREEN" && item.variance === 0)).toBe(true);

    const stored = await getPrisma().cuttingOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.status).toBe("VERIFIED");
    expect(stored.verifiedAt?.toISOString()).toBe(log.timestamp);
  });

  it("Test 2: an order with at least one RED (shortage) component blocks approval and returns an error", async () => {
    const order = await pendingOrder(people);
    await saveComponentCounts(people.verifier, order.id, counts(order, { "Sleeve Cuffs": 98 }));

    const response = await approve(order.id);

    expect(response.status).toBe(422);
    expect(response.json.success).toBe(false);
    expect(response.json.error.code).toBe("VERIFICATION_GATE_BLOCKED");
    const violations = response.json.error.details?.violations as Array<{ code: string; componentName: string }>;
    expect(violations).toEqual([expect.objectContaining({ code: "SHORTAGE", componentName: "Sleeve Cuffs" })]);

    // Nothing was written: still pending, no audit record, not in the sewing queue.
    const stored = await getPrisma().cuttingOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.status).toBe("PENDING_VERIFICATION");
    expect(await getPrisma().verificationLog.count({ where: { orderId: order.id } })).toBe(0);
    const queue = await getSewingQueue(people.sewing);
    expect(queue.map((batch) => batch.id)).not.toContain(order.id);
  });

  it("Test 3: rejecting an order without a reason note is rejected by backend validation", async () => {
    const order = await pendingOrder(people);

    for (const body of [{}, { reason: "" }, { reason: "      " }, { reason: "too short" }, { reason: null }, { reason: 42 }]) {
      const response = await call(rejectRoute, { method: "POST", as: people.verifier, body, params: { orderId: order.id } });
      expect(response.status, JSON.stringify(body)).toBe(422);
      expect(response.json.error.code).toBe("VALIDATION_FAILED");
    }
    const emptyBody = await call(rejectRoute, { method: "POST", as: people.verifier, params: { orderId: order.id } });
    expect(emptyBody.status).toBe(422);

    const stored = await getPrisma().cuttingOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.status).toBe("PENDING_VERIFICATION");
    expect(await getPrisma().verificationLog.count({ where: { orderId: order.id } })).toBe(0);

    // With a reason, the rejection is accepted and recorded.
    const accepted = await call<DecisionResultDTO>(rejectRoute, {
      method: "POST",
      as: people.verifier,
      body: { reason: "Collar & Stand edges frayed — re-cut 50 collars." },
      params: { orderId: order.id },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.json.data.order.status).toBe("REJECTED");
    expect(accepted.json.data.log.rejectionNote).toBe("Collar & Stand edges frayed — re-cut 50 collars.");
  });

  it("Test 4: non-verifier roles receive 403 Forbidden when attempting verification approval", async () => {
    const order = await pendingOrder(people);
    await saveComponentCounts(people.verifier, order.id, counts(order));

    for (const intruder of [people.supervisor, people.sewing]) {
      const response = await approve(order.id, intruder);
      expect(response.status).toBe(403);
      expect(response.json.error.code).toBe("FORBIDDEN");

      const rejection = await call(rejectRoute, {
        method: "POST",
        as: intruder,
        body: { reason: "Trying to bypass separation of duties" },
        params: { orderId: order.id },
      });
      expect(rejection.status).toBe(403);

      const countAttempt = await call(countsRoute, { method: "PUT", as: intruder, body: counts(order), params: { orderId: order.id } });
      expect(countAttempt.status).toBe(403);
    }

    const anonymous = await call(approveRoute, { method: "POST", params: { orderId: order.id } });
    expect(anonymous.status).toBe(401);

    const stored = await getPrisma().cuttingOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.status).toBe("PENDING_VERIFICATION");
  });

  it("Test 5: unapproved orders never appear in the Sewing Queue database query", async () => {
    const inCutting = await createCuttingOrder(people.supervisor, {
      recipeId: await recipeId("REC-CT02"),
      targetQty: 30,
      fabricRollId: "FAB-ROLL-100",
      actualFabricYds: 34,
    });
    const pending = await pendingOrder(people);
    const rejected = await rejectedOrder(people);
    const verified = await verifiedOrder(people);
    const unapproved = [inCutting.id, pending.id, rejected.id];

    // Service-level query.
    const queue = await getSewingQueue(people.sewing);
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.every((batch) => batch.status === "VERIFIED")).toBe(true);
    expect(queue.map((batch) => batch.id)).toContain(verified.id);
    for (const id of unapproved) expect(queue.map((batch) => batch.id)).not.toContain(id);

    // API, including attempts to widen the filter through URL parameters.
    for (const path of [
      "/api/sewing/queue",
      "/api/sewing/queue?status=PENDING_VERIFICATION",
      "/api/sewing/queue?status=REJECTED&include=all",
    ]) {
      const response = await call<SewingBatchDTO[]>(sewingQueueRoute, { as: people.sewing, path });
      expect(response.status).toBe(200);
      const ids = response.json.data.map((batch) => batch.id);
      expect(response.json.data.every((batch) => batch.status === "VERIFIED")).toBe(true);
      for (const id of unapproved) expect(ids).not.toContain(id);
    }

    // Direct lookups of unapproved orders are indistinguishable from "not found".
    for (const orderId of unapproved) {
      const response = await call(sewingBatchRoute, { as: people.sewing, params: { orderId } });
      expect(response.status).toBe(404);
    }
    const visible = await call<SewingBatchDTO>(sewingBatchRoute, { as: people.sewing, params: { orderId: verified.id } });
    expect(visible.status).toBe(200);
    expect(visible.json.data.approval.verifier.id).toBe(people.verifier.id);
  });
});

describe("Gatekeeper hard stop — edge cases", () => {
  it("allows YELLOW (surplus) components through and records the variance", async () => {
    const order = await pendingOrder(people);
    await saveComponentCounts(people.verifier, order.id, counts(order, { "Collar & Stand": 52 }));

    const response = await approve(order.id, people.verifier, { note: "2 surplus collars returned to stores." });

    expect(response.status).toBe(200);
    const collar = response.json.data.log.items.find((item) => item.componentName === "Collar & Stand");
    expect(collar).toMatchObject({ expectedQty: 50, actualQty: 52, variance: 2, status: "YELLOW" });
    expect(response.json.data.log.approvalNote).toBe("2 surplus collars returned to stores.");
  });

  it("blocks approval while any component is uncounted", async () => {
    const order = await pendingOrder(people);
    const partial = counts(order);
    await saveComponentCounts(people.verifier, order.id, { items: partial.items.slice(0, 3) });

    const response = await approve(order.id);

    expect(response.status).toBe(422);
    const codes = (response.json.error.details?.violations as Array<{ code: string }>).map((violation) => violation.code);
    expect(codes).toEqual(["UNCOUNTED_COMPONENT", "UNCOUNTED_COMPONENT"]);
  });

  it("blocks approval when a recipe component is missing from the count sheet", async () => {
    const order = await pendingOrder(people, { recipe: "REC-CT02", targetQty: 10, actualFabricYds: 11 });
    await saveComponentCounts(people.verifier, order.id, counts(order));
    // The BOM gains a part after the sheet was issued: the sheet is now incomplete.
    await getPrisma().recipeComponent.create({
      data: { recipeId: await recipeId("REC-CT02"), componentName: "Test Pocket Facing", piecesPerGarment: 1, sortOrder: 99 },
    });
    try {
      const response = await approve(order.id);
      expect(response.status).toBe(422);
      const violations = response.json.error.details?.violations as Array<{ code: string; componentName: string }>;
      expect(violations).toContainEqual(expect.objectContaining({ code: "MISSING_COMPONENT", componentName: "Test Pocket Facing" }));
    } finally {
      await getPrisma().recipeComponent.deleteMany({ where: { componentName: "Test Pocket Facing" } });
    }
  });

  it("ignores no client input for identity: a forged verifierId or status is rejected outright", async () => {
    const order = await pendingOrder(people);
    await saveComponentCounts(people.verifier, order.id, counts(order));

    for (const body of [{ verifierId: people.supervisor.id }, { status: "VERIFIED" }, { timestamp: "2020-01-01T00:00:00Z" }]) {
      const response = await approve(order.id, people.verifier, body);
      expect(response.status).toBe(422);
    }
    expect(await getPrisma().verificationLog.count({ where: { orderId: order.id } })).toBe(0);
  });

  it("rejects client-supplied traffic-light status and invalid counts", async () => {
    const order = await pendingOrder(people);
    const componentId = order.verificationItems[0]!.componentId;
    const bad = [
      { items: [{ componentId, actualQty: 1, status: "GREEN" }] },
      { items: [{ componentId, actualQty: -1 }] },
      { items: [{ componentId, actualQty: 2.5 }] },
      { items: [{ componentId, actualQty: "50" }] },
      { items: [{ componentId, actualQty: null }] },
      { items: [] },
      { items: [{ componentId: "00000000-0000-4000-8000-000000000000", actualQty: 5 }] },
      { items: [{ componentId, actualQty: 5 }, { componentId, actualQty: 6 }] },
    ];
    for (const body of bad) {
      const response = await call(countsRoute, { method: "PUT", as: people.verifier, body, params: { orderId: order.id } });
      expect(response.status, JSON.stringify(body)).toBe(422);
    }
    const sheet = await getPrisma().verificationItem.findMany({ where: { orderId: order.id } });
    expect(sheet.every((item) => item.actualQty === null && item.status === null)).toBe(true);
  });

  it("derives the traffic light on the server when counts are saved", async () => {
    const order = await pendingOrder(people);
    await call(countsRoute, {
      method: "PUT",
      as: people.verifier,
      body: counts(order, { "Sleeve Cuffs": 99, "Collar & Stand": 51 }),
      params: { orderId: order.id },
    });
    const sheet = await getPrisma().verificationItem.findMany({ where: { orderId: order.id }, include: { component: true } });
    const status = Object.fromEntries(sheet.map((item) => [item.component.componentName, item.status]));
    expect(status).toMatchObject({ "Sleeve Cuffs": "RED", "Collar & Stand": "YELLOW", "Front Body Panel": "GREEN" });
    expect(sheet.every((item) => item.countedById === people.verifier.id)).toBe(true);
  });

  it("returns 409 for illegal transitions (approving twice, approving a batch still in cutting)", async () => {
    const verified = await verifiedOrder(people);
    expect((await approve(verified.id)).status).toBe(409);

    const inCutting = await createCuttingOrder(people.supervisor, {
      recipeId: await recipeId("REC-BL01"),
      targetQty: 10,
      fabricRollId: "FAB-ROLL-200",
      actualFabricYds: 18,
    });
    const response = await approve(inCutting.id);
    expect(response.status).toBe(409);
    expect(response.json.error.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("returns 404 for unknown or malformed order ids", async () => {
    expect((await approve("00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await approve("not-a-uuid")).status).toBe(404);
  });

  it("serialises concurrent approvals: exactly one succeeds", async () => {
    const order = await pendingOrder(people);
    await saveComponentCounts(people.verifier, order.id, counts(order));

    const results = await Promise.all([approve(order.id), approve(order.id), approve(order.id)]);
    const statuses = results.map((result) => result.status).sort();

    expect(statuses).toEqual([200, 409, 409]);
    expect(await getPrisma().verificationLog.count({ where: { orderId: order.id } })).toBe(1);
  });
});
