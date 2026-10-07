import "server-only";
import type { RecipeDTO } from "@/lib/dto";
import { assertPermission, type AuthUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db";
import { NotFoundError } from "@/server/http/errors";
import { parseResourceId } from "@/server/http/request";
import { recipeWithComponentsInclude, toRecipeDTO } from "@/server/mappers";

export async function listRecipes(actor: AuthUser): Promise<RecipeDTO[]> {
  assertPermission(actor, "recipe:read");
  const recipes = await getPrisma().recipe.findMany({
    include: recipeWithComponentsInclude,
    orderBy: { recipeCode: "asc" },
  });
  return recipes.map(toRecipeDTO);
}

export async function getRecipe(actor: AuthUser, recipeId: string): Promise<RecipeDTO> {
  assertPermission(actor, "recipe:read");
  const id = parseResourceId(recipeId, "Recipe not found.");
  const recipe = await getPrisma().recipe.findUnique({ where: { id }, include: recipeWithComponentsInclude });
  if (!recipe) throw new NotFoundError("Recipe not found.");
  return toRecipeDTO(recipe);
}
