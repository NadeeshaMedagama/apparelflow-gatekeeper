import { BookOpen, Layers, Percent, Ruler } from "lucide-react";
import type { Metadata } from "next";
import { ComponentThumb } from "@/components/component-thumb";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { totalPiecesPerGarment } from "@/domain/production";
import { formatPercent } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/page-guards";
import { listRecipes } from "@/server/services/recipes";

export const metadata: Metadata = { title: "Recipe Library" };

export default async function RecipesPage() {
  const user = await requirePagePermission("recipe:read");
  const recipes = await listRecipes(user);

  return (
    <>
      <PageHeader
        title="Recipe Library"
        description="Production recipes (bills of materials). Each recipe defines the cut parts per garment used by the multiplier engine. Read-only in this module."
      />
      {recipes.length === 0 ? (
        <Card>
          <EmptyState icon={<BookOpen className="size-6" aria-hidden="true" />} title="No recipes" description="Run the seed script to load the production recipes." />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {recipes.map((recipe) => (
            <Card key={recipe.id}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{recipe.name}</h2>
                  <p className="text-sm text-slate-600">{recipe.category}</p>
                </div>
                <Badge tone="blue">{recipe.recipeCode}</Badge>
              </div>
              <dl className="grid grid-cols-3 gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Ruler className="size-3.5" aria-hidden="true" /> Std fabric
                  </dt>
                  <dd className="tabular mt-0.5 text-base font-bold text-slate-900">{recipe.stdFabricYards} yd / garment</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Percent className="size-3.5" aria-hidden="true" /> Wastage cap
                  </dt>
                  <dd className="tabular mt-0.5 text-base font-bold text-slate-900">{formatPercent(recipe.wastageCap)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Layers className="size-3.5" aria-hidden="true" /> Cut parts
                  </dt>
                  <dd className="tabular mt-0.5 text-base font-bold text-slate-900">
                    {totalPiecesPerGarment(recipe.components)} pcs / garment
                  </dd>
                </div>
              </dl>
              <ul className="divide-y divide-slate-200">
                {recipe.components.map((component) => (
                  <li key={component.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="flex items-center gap-3">
                      <ComponentThumb imageUrl={component.imageUrl} />
                      <span className="font-medium text-slate-900">{component.componentName}</span>
                    </span>
                    <span className="tabular rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 text-sm font-semibold text-slate-800">
                      {component.piecesPerGarment} pcs / garment
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
