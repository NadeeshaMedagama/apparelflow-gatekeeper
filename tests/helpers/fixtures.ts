import type { CuttingOrderDetailDTO } from "@/lib/dto";
import type { AuthUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db";
import { createCuttingOrder } from "@/server/services/cutting-orders";
import { approveBatch, rejectBatch, saveComponentCounts } from "@/server/services/verification";

export interface Personas {
  supervisor: AuthUser;
  verifier: AuthUser;
  sewing: AuthUser;
}

export async function personas(): Promise<Personas> {
  const users = await getPrisma().user.findMany({ select: { id: true, email: true, fullName: true, role: true } });
  const byRole = (role: AuthUser["role"]) => {
    const user = users.find((candidate) => candidate.role === role);
    if (!user) throw new Error(`Seeded ${role} not found`);
    return user;
  };
  return {
    supervisor: byRole("CUTTING_SUPERVISOR"),
    verifier: byRole("CUTTING_VERIFIER"),
    sewing: byRole("SEWING_SUPERVISOR"),
  };
}

export async function recipeId(code: "REC-BL01" | "REC-CT02"): Promise<string> {
  const recipe = await getPrisma().recipe.findUniqueOrThrow({ where: { recipeCode: code }, select: { id: true } });
  return recipe.id;
}

/** Creates a batch through the real service and leaves it at the QC station. */
export async function pendingOrder(
  people: Personas,
  options: { recipe?: "REC-BL01" | "REC-CT02"; targetQty?: number; actualFabricYds?: number } = {},
): Promise<CuttingOrderDetailDTO> {
  return createCuttingOrder(people.supervisor, {
    recipeId: await recipeId(options.recipe ?? "REC-BL01"),
    targetQty: options.targetQty ?? 50,
    fabricRollId: "FAB-ROLL-882",
    actualFabricYds: options.actualFabricYds ?? 92,
    submitForVerification: true,
  });
}

/** Count-sheet payload: every component at its expected quantity, with optional overrides by name. */
export function counts(order: CuttingOrderDetailDTO, overrides: Record<string, number> = {}) {
  return {
    items: order.verificationItems.map((item) => ({
      componentId: item.componentId,
      actualQty: overrides[item.componentName] ?? item.expectedQty,
    })),
  };
}

export async function verifiedOrder(people: Personas, options: Parameters<typeof pendingOrder>[1] = {}) {
  const order = await pendingOrder(people, options);
  await saveComponentCounts(people.verifier, order.id, counts(order));
  await approveBatch(people.verifier, order.id, {});
  return order;
}

export async function rejectedOrder(people: Personas) {
  const order = await pendingOrder(people);
  await saveComponentCounts(people.verifier, order.id, counts(order, { "Sleeve Cuffs": 90 }));
  await rejectBatch(people.verifier, order.id, { reason: "Sleeve Cuffs short by 10 pieces — re-cut required." });
  return order;
}
