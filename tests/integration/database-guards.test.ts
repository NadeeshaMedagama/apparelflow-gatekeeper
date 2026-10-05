import { beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "@/server/db";
import { saveComponentCounts } from "@/server/services/verification";
import { counts, pendingOrder, personas, verifiedOrder, type Personas } from "../helpers/fixtures";

/**
 * Defence in depth: even code that bypasses the API and the services — a
 * raw ORM call, a future bug — cannot push a short batch to sewing or rewrite
 * the audit trail, because PostgreSQL itself refuses.
 */
let people: Personas;

beforeAll(async () => {
  people = await personas();
});

describe("Database integrity guards", () => {
  it("refuses to mark a short batch VERIFIED even without the API", async () => {
    const order = await pendingOrder(people);
    await saveComponentCounts(people.verifier, order.id, counts(order, { "Sleeve Cuffs": 10 }));

    await expect(
      getPrisma().cuttingOrder.update({ where: { id: order.id }, data: { status: "VERIFIED", verifiedAt: new Date() } }),
    ).rejects.toThrow(/Gatekeeper hard stop/);
  });

  it("refuses VERIFIED without an APPROVED audit record, even when every count is green", async () => {
    const order = await pendingOrder(people);
    await saveComponentCounts(people.verifier, order.id, counts(order));

    await expect(
      getPrisma().cuttingOrder.update({ where: { id: order.id }, data: { status: "VERIFIED", verifiedAt: new Date() } }),
    ).rejects.toThrow(/no APPROVED verification record/);
  });

  it("refuses illegal state jumps", async () => {
    const order = await pendingOrder(people);
    await expect(
      getPrisma().cuttingOrder.update({
        where: { id: order.id },
        data: { status: "SEWING_IN_PROGRESS", sewingStartedAt: new Date(), sewingStartedById: people.sewing.id },
      }),
    ).rejects.toThrow(/Illegal cutting order transition/);
  });

  it("keeps verification logs, snapshots and status events append-only", async () => {
    const order = await verifiedOrder(people);
    const prisma = getPrisma();

    await expect(prisma.verificationLog.updateMany({ where: { orderId: order.id }, data: { wastagePct: 0 } })).rejects.toThrow(/append-only/);
    await expect(prisma.verificationLog.deleteMany({ where: { orderId: order.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.verificationLogItem.updateMany({ data: { actualQty: 0 } })).rejects.toThrow(/append-only/);
    await expect(prisma.orderStatusEvent.deleteMany({ where: { orderId: order.id } })).rejects.toThrow(/append-only/);
  });

  it("locks a verified count sheet and batch details", async () => {
    const order = await verifiedOrder(people);
    const prisma = getPrisma();

    await expect(prisma.verificationItem.updateMany({ where: { orderId: order.id }, data: { actualQty: 1, status: "RED" } })).rejects.toThrow(/locked/);
    await expect(prisma.cuttingOrder.update({ where: { id: order.id }, data: { targetQty: 1 } })).rejects.toThrow(/locked/);
  });

  it("never stores a traffic light that contradicts the count", async () => {
    const order = await pendingOrder(people);
    const item = await getPrisma().verificationItem.findFirstOrThrow({ where: { orderId: order.id } });

    await expect(
      getPrisma().verificationItem.update({ where: { id: item.id }, data: { actualQty: item.expectedQty - 1, status: "GREEN" } }),
    ).rejects.toThrow(/verification_items_status_matches_count_chk/);
  });
});
