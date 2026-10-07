/**
 * Seeds reference data (demo users + recipes) and, on an empty database, a set
 * of demo batches covering every pipeline state.
 *
 * Demo batches are created through the real domain services — the same code
 * paths the API uses — so their audit logs, count sheets and status events are
 * exactly what the application itself would have produced.
 *
 * Run with: npm run db:seed
 */
import "dotenv/config";
import { DEMO_PASSWORD } from "../src/lib/demo-accounts";
import type { AuthUser } from "../src/server/auth/current-user";
import { hashPassword } from "../src/server/auth/password";
import { disconnectPrisma, getPrisma } from "../src/server/db";
import { createCuttingOrder, submitForVerification } from "../src/server/services/cutting-orders";
import { startSewingAssembly } from "../src/server/services/sewing";
import { approveBatch, rejectBatch, saveComponentCounts } from "../src/server/services/verification";
import { seedReferenceData } from "./seed-data";

async function loadActor(email: string): Promise<AuthUser> {
  return getPrisma().user.findUniqueOrThrow({
    where: { email },
    select: { id: true, email: true, fullName: true, role: true },
  });
}

async function seedDemoOrders(): Promise<void> {
  const prisma = getPrisma();
  if ((await prisma.cuttingOrder.count()) > 0) {
    console.log("• Cutting orders already exist — demo batches skipped.");
    return;
  }

  const supervisor = await loadActor("supervisor@apparelflow.demo");
  const verifier = await loadActor("verifier@apparelflow.demo");
  const sewing = await loadActor("sewing@apparelflow.demo");
  const blouse = await prisma.recipe.findUniqueOrThrow({ where: { recipeCode: "REC-BL01" } });
  const cropTop = await prisma.recipe.findUniqueOrThrow({ where: { recipeCode: "REC-CT02" } });

  const exactCounts = (items: Array<{ componentId: string; expectedQty: number }>) =>
    items.map((item) => ({ componentId: item.componentId, actualQty: item.expectedQty }));

  // 1. Verified batch waiting in the Sewing Queue (all GREEN, 2.22% wastage).
  const verified = await createCuttingOrder(supervisor, {
    recipeId: blouse.id,
    targetQty: 50,
    fabricRollId: "FAB-ROLL-882",
    actualFabricYds: 92,
    submitForVerification: true,
  });
  await saveComponentCounts(verifier, verified.id, { items: exactCounts(verified.verificationItems) });
  await approveBatch(verifier, verified.id, { note: "All bundles counted and tagged. Released to line 3." });

  // 2. Batch at the QC station, not yet counted — ready for an evaluator to verify.
  await createCuttingOrder(supervisor, {
    recipeId: cropTop.id,
    targetQty: 120,
    fabricRollId: "FAB-ROLL-417",
    actualFabricYds: 140.5,
    submitForVerification: true,
  });

  // 3. Rejected batch: Sleeve Cuffs short by 6 (RED) — back with the supervisor.
  const rejected = await createCuttingOrder(supervisor, {
    recipeId: blouse.id,
    targetQty: 80,
    fabricRollId: "FAB-ROLL-903",
    actualFabricYds: 150,
    submitForVerification: true,
  });
  await saveComponentCounts(verifier, rejected.id, {
    items: rejected.verificationItems.map((item) => ({
      componentId: item.componentId,
      actualQty: item.componentName === "Sleeve Cuffs" ? item.expectedQty - 6 : item.expectedQty,
    })),
  });
  await rejectBatch(verifier, rejected.id, {
    category: "COMPONENT_SHORTAGE",
    reason: "Sleeve Cuffs short by 6 pieces (154 of 160). Re-cut the missing cuffs from roll FAB-ROLL-903.",
  });

  // 4. Batch still on the cutting table.
  await createCuttingOrder(supervisor, {
    recipeId: cropTop.id,
    targetQty: 60,
    fabricRollId: "FAB-ROLL-221",
    actualFabricYds: 68,
  });

  // 5. Batch already on the assembly line (one YELLOW surplus, approved with a note).
  const sewingBatch = await createCuttingOrder(supervisor, {
    recipeId: blouse.id,
    targetQty: 40,
    fabricRollId: "FAB-ROLL-560",
    actualFabricYds: 73.5,
  });
  await submitForVerification(supervisor, sewingBatch.id);
  const sheet = await getPrisma().verificationItem.findMany({
    where: { orderId: sewingBatch.id },
    include: { component: true },
  });
  await saveComponentCounts(verifier, sewingBatch.id, {
    items: sheet.map((item) => ({
      componentId: item.componentId,
      actualQty: item.component.componentName === "Collar & Stand" ? item.expectedQty + 2 : item.expectedQty,
    })),
  });
  await approveBatch(verifier, sewingBatch.id, { note: "2 surplus collars kept as a safety margin." });
  await startSewingAssembly(sewing, sewingBatch.id);

  console.log("• Demo batches created: VERIFIED, PENDING_VERIFICATION, REJECTED, CUTTING_IN_PROGRESS, SEWING_IN_PROGRESS.");
}

async function main(): Promise<void> {
  const prisma = getPrisma();
  await seedReferenceData(prisma, await hashPassword(DEMO_PASSWORD));
  console.log("• Demo users and recipes (REC-BL01, REC-CT02) are up to date.");
  if (process.env.SEED_DEMO_ORDERS !== "false") {
    await seedDemoOrders();
  }
}

main()
  .then(() => console.log("Seed complete."))
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => disconnectPrisma());
