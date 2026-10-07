import { beforeAll, describe, expect, it } from "vitest";
import { GET as assemblyRoute } from "@/app/api/sewing/assembly/route";
import { GET as queueRoute } from "@/app/api/sewing/queue/route";
import { POST as startRoute } from "@/app/api/sewing/queue/[orderId]/start/route";
import type { SewingBatchDTO } from "@/lib/dto";
import { call } from "../helpers/api";
import { pendingOrder, personas, verifiedOrder, type Personas } from "../helpers/fixtures";

let people: Personas;

beforeAll(async () => {
  people = await personas();
});

describe("Sewing floor", () => {
  it("is closed to the cutting roles", async () => {
    for (const intruder of [people.supervisor, people.verifier]) {
      expect((await call(queueRoute, { as: intruder })).status).toBe(403);
      expect((await call(assemblyRoute, { as: intruder })).status).toBe(403);
    }
    expect((await call(queueRoute)).status).toBe(401);
  });

  it("starts assembly for a verified batch exactly once and records who started it", async () => {
    const order = await verifiedOrder(people);

    const started = await call<SewingBatchDTO>(startRoute, { method: "POST", as: people.sewing, params: { orderId: order.id } });
    expect(started.status).toBe(200);
    expect(started.json.data.status).toBe("SEWING_IN_PROGRESS");
    expect(started.json.data.sewingStartedBy?.id).toBe(people.sewing.id);

    const again = await call(startRoute, { method: "POST", as: people.sewing, params: { orderId: order.id } });
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe("SEWING_ALREADY_STARTED");

    const queue = await call<SewingBatchDTO[]>(queueRoute, { as: people.sewing });
    expect(queue.json.data.map((batch) => batch.id)).not.toContain(order.id);
    const assembly = await call<SewingBatchDTO[]>(assemblyRoute, { as: people.sewing });
    expect(assembly.json.data.map((batch) => batch.id)).toContain(order.id);
  });

  it("cannot start sewing on an unverified batch (it is invisible: 404)", async () => {
    const order = await pendingOrder(people);
    const response = await call(startRoute, { method: "POST", as: people.sewing, params: { orderId: order.id } });
    expect(response.status).toBe(404);
  });

  it("does not let the cutting roles start sewing", async () => {
    const order = await verifiedOrder(people);
    for (const intruder of [people.supervisor, people.verifier]) {
      expect((await call(startRoute, { method: "POST", as: intruder, params: { orderId: order.id } })).status).toBe(403);
    }
  });
});
