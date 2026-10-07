import type { PrismaClient } from "@prisma/client";
import { DEMO_ACCOUNTS } from "../src/lib/demo-accounts";

/** Production recipes (Bill of Materials) exactly as specified in the brief. */
export const RECIPES = [
  {
    recipeCode: "REC-BL01",
    name: "Casual Blouse",
    category: "Blouse",
    stdFabricYards: "1.800",
    wastageCap: "5.00",
    components: [
      { componentName: "Front Body Panel", piecesPerGarment: 1, imageUrl: "/components/front-body-panel.svg" },
      { componentName: "Back Body Panel", piecesPerGarment: 1, imageUrl: "/components/back-body-panel.svg" },
      { componentName: "Sleeves (Left & Right)", piecesPerGarment: 2, imageUrl: "/components/sleeve.svg" },
      { componentName: "Collar & Stand", piecesPerGarment: 1, imageUrl: "/components/collar-stand.svg" },
      { componentName: "Sleeve Cuffs", piecesPerGarment: 2, imageUrl: "/components/sleeve-cuff.svg" },
    ],
  },
  {
    recipeCode: "REC-CT02",
    name: "Crop Top",
    category: "Crop Top",
    stdFabricYards: "1.100",
    wastageCap: "8.00",
    components: [
      { componentName: "Front Chest Panel", piecesPerGarment: 1, imageUrl: "/components/front-chest-panel.svg" },
      { componentName: "Back Support Panel", piecesPerGarment: 1, imageUrl: "/components/back-support-panel.svg" },
      { componentName: "Neck Binding Strip", piecesPerGarment: 1, imageUrl: "/components/neck-binding-strip.svg" },
      { componentName: "Hem Elastic Casing", piecesPerGarment: 1, imageUrl: "/components/hem-elastic-casing.svg" },
      { componentName: "Side Strap Accents", piecesPerGarment: 2, imageUrl: "/components/side-strap-accent.svg" },
    ],
  },
] as const;

/**
 * Idempotently upserts the demo users and the two production recipes.
 * Safe to run repeatedly against any environment.
 */
export async function seedReferenceData(prisma: PrismaClient, passwordHash: string): Promise<void> {
  for (const account of DEMO_ACCOUNTS) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: { fullName: account.fullName, role: account.role, passwordHash },
      create: { email: account.email, fullName: account.fullName, role: account.role, passwordHash },
    });
  }

  for (const recipe of RECIPES) {
    const saved = await prisma.recipe.upsert({
      where: { recipeCode: recipe.recipeCode },
      update: {
        name: recipe.name,
        category: recipe.category,
        stdFabricYards: recipe.stdFabricYards,
        wastageCap: recipe.wastageCap,
      },
      create: {
        recipeCode: recipe.recipeCode,
        name: recipe.name,
        category: recipe.category,
        stdFabricYards: recipe.stdFabricYards,
        wastageCap: recipe.wastageCap,
      },
    });

    for (const [index, component] of recipe.components.entries()) {
      await prisma.recipeComponent.upsert({
        where: { recipeId_componentName: { recipeId: saved.id, componentName: component.componentName } },
        update: { piecesPerGarment: component.piecesPerGarment, imageUrl: component.imageUrl, sortOrder: index },
        create: {
          recipeId: saved.id,
          componentName: component.componentName,
          piecesPerGarment: component.piecesPerGarment,
          imageUrl: component.imageUrl,
          sortOrder: index,
        },
      });
    }
  }
}
