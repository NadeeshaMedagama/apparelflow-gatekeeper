"use client";

import { Calculator } from "lucide-react";
import { useState } from "react";
import { FormField, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { LIMITS } from "@/domain/limits";
import { calculateExpectedComponents } from "@/domain/production";
import { fabricRollIdSchema, parseDecimalInput, parseWholeNumberInput } from "@/domain/validation";
import { calculateExpectedFabricYards, evaluateWastage } from "@/domain/wastage";
import type { RecipeDTO } from "@/lib/dto";
import { formatInteger, formatPercent, formatYards } from "@/lib/format";
import { ExpectedComponentsTable } from "./expected-components-table";

export type OrderField = "recipeId" | "targetQty" | "fabricRollId" | "actualFabricYds";
export type OrderFormValues = Record<OrderField, string>;

export interface ParsedOrderForm {
  valid: boolean;
  errors: Partial<Record<OrderField, string>>;
  data?: { recipeId: string; targetQty: number; fabricRollId: string; actualFabricYds: number };
}

/** Strict client-side parse; the same rules run again on the server. */
export function parseOrderForm(values: OrderFormValues, recipes: RecipeDTO[]): ParsedOrderForm {
  const errors: Partial<Record<OrderField, string>> = {};
  const recipe = recipes.find((item) => item.id === values.recipeId);
  if (!recipe) errors.recipeId = "Select a recipe";
  const qty = parseWholeNumberInput(values.targetQty, {
    label: "Target batch quantity",
    min: LIMITS.targetQty.min,
    max: LIMITS.targetQty.max,
  });
  if (!qty.ok) errors.targetQty = qty.error;
  const roll = fabricRollIdSchema.safeParse(values.fabricRollId);
  if (!roll.success) errors.fabricRollId = roll.error.issues[0]?.message ?? "Invalid fabric roll ID";
  const fabric = parseDecimalInput(values.actualFabricYds, {
    label: "Actual fabric used",
    min: LIMITS.fabricYards.min,
    max: LIMITS.fabricYards.max,
    decimals: LIMITS.fabricYards.decimals,
  });
  if (!fabric.ok) errors.actualFabricYds = fabric.error;

  if (!recipe || !qty.ok || !roll.success || !fabric.ok) return { valid: false, errors };
  return {
    valid: true,
    errors,
    data: { recipeId: recipe.id, targetQty: qty.value, fabricRollId: roll.data, actualFabricYds: fabric.value },
  };
}

/**
 * Shared fields + live multiplier preview for creating and editing orders.
 * Errors appear immediately while typing; "required" errors appear once a
 * field has been visited or a submit was attempted.
 */
export function OrderFormFields({
  recipes,
  values,
  onChange,
  serverErrors,
  showAllErrors,
  lockRecipe = false,
}: {
  recipes: RecipeDTO[];
  values: OrderFormValues;
  onChange: (field: OrderField, value: string) => void;
  serverErrors: Partial<Record<OrderField, string>>;
  showAllErrors: boolean;
  lockRecipe?: boolean;
}) {
  const [touched, setTouched] = useState<Partial<Record<OrderField, boolean>>>({});
  const parsed = parseOrderForm(values, recipes);
  const recipe = recipes.find((item) => item.id === values.recipeId) ?? null;

  const visibleError = (field: OrderField): string | undefined => {
    if (serverErrors[field]) return serverErrors[field];
    const show = showAllErrors || touched[field] || values[field] !== "";
    return show ? parsed.errors[field] : undefined;
  };
  const blur = (field: OrderField) => setTouched((current) => ({ ...current, [field]: true }));

  const qty = parseWholeNumberInput(values.targetQty, { label: "Quantity", min: 1, max: LIMITS.targetQty.max });
  const fabric = parseDecimalInput(values.actualFabricYds, {
    label: "Fabric",
    min: LIMITS.fabricYards.min,
    max: LIMITS.fabricYards.max,
    decimals: LIMITS.fabricYards.decimals,
  });
  const expected = recipe && qty.ok ? calculateExpectedComponents(qty.value, recipe.components) : null;
  const wastage =
    recipe && qty.ok && fabric.ok
      ? evaluateWastage({
          targetQty: qty.value,
          stdFabricYards: recipe.stdFabricYards,
          actualFabricYds: fabric.value,
          wastageCap: recipe.wastageCap,
        })
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]">
      <div className="space-y-5">
        <FormField
          id="recipeId"
          label="Production recipe"
          required
          error={visibleError("recipeId")}
          hint={lockRecipe ? "The recipe cannot change after an order is created." : "Bill of materials used to derive component counts."}
        >
          {(describedBy) => (
            <Select
              id="recipeId"
              name="recipeId"
              value={values.recipeId}
              onChange={(event) => onChange("recipeId", event.target.value)}
              onBlur={() => blur("recipeId")}
              invalid={Boolean(visibleError("recipeId"))}
              aria-describedby={describedBy}
              disabled={lockRecipe}
              required
            >
              <option value="">Select a recipe…</option>
              {recipes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {item.recipeCode} ({item.stdFabricYards} yd / garment)
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          id="targetQty"
          label="Target batch quantity (garments)"
          required
          error={visibleError("targetQty")}
          hint={`Whole number from 1 to ${formatInteger(LIMITS.targetQty.max)}.`}
        >
          {(describedBy) => (
            <Input
              id="targetQty"
              name="targetQty"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 50"
              value={values.targetQty}
              onChange={(event) => onChange("targetQty", event.target.value)}
              onBlur={() => blur("targetQty")}
              invalid={Boolean(visibleError("targetQty"))}
              aria-describedby={describedBy}
              required
            />
          )}
        </FormField>

        <FormField
          id="fabricRollId"
          label="Fabric roll ID"
          required
          error={visibleError("fabricRollId")}
          hint="Letters, digits and hyphens — e.g. FAB-ROLL-882."
        >
          {(describedBy) => (
            <Input
              id="fabricRollId"
              name="fabricRollId"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="FAB-ROLL-882"
              value={values.fabricRollId}
              onChange={(event) => onChange("fabricRollId", event.target.value.toUpperCase())}
              onBlur={() => blur("fabricRollId")}
              invalid={Boolean(visibleError("fabricRollId"))}
              aria-describedby={describedBy}
              className="font-mono"
              required
            />
          )}
        </FormField>

        <FormField
          id="actualFabricYds"
          label="Actual fabric used (yards)"
          required
          error={visibleError("actualFabricYds")}
          hint="Measured length consumed by this batch, up to 2 decimal places."
        >
          {(describedBy) => (
            <Input
              id="actualFabricYds"
              name="actualFabricYds"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 92.50"
              value={values.actualFabricYds}
              onChange={(event) => onChange("actualFabricYds", event.target.value)}
              onBlur={() => blur("actualFabricYds")}
              invalid={Boolean(visibleError("actualFabricYds"))}
              aria-describedby={describedBy}
              required
            />
          )}
        </FormField>
      </div>

      <section aria-labelledby="multiplier-title" className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="multiplier-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Calculator className="size-4 text-blue-700" aria-hidden="true" />
              Multiplier engine
            </h3>
            <p className="mt-0.5 text-sm text-slate-600">Expected pieces = batch quantity × pieces per garment.</p>
          </div>
          {recipe ? <Badge tone="blue">{recipe.recipeCode}</Badge> : null}
        </div>

        <div className="mt-4" aria-live="polite">
          {expected && qty.ok ? (
            <div className="space-y-4">
              <ExpectedComponentsTable components={expected} targetQty={qty.value} />
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <dt className="text-xs font-medium text-slate-600">Expected fabric</dt>
                  <dd className="tabular mt-0.5 text-base font-bold text-slate-900">
                    {recipe ? formatYards(calculateExpectedFabricYards(qty.value, recipe.stdFabricYards)) : "—"}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <dt className="text-xs font-medium text-slate-600">Projected wastage</dt>
                  <dd className="mt-0.5 flex flex-wrap items-center gap-2">
                    {wastage ? (
                      <>
                        <span className={wastage.exceedsCap ? "tabular text-base font-bold text-amber-800" : "tabular text-base font-bold text-slate-900"}>
                          {formatPercent(wastage.wastagePct, { signed: true })}
                        </span>
                        <Badge tone={wastage.exceedsCap ? "amber" : "green"}>
                          {wastage.exceedsCap ? `Above ${formatPercent(wastage.wastageCap)} cap` : `Within ${formatPercent(wastage.wastageCap)} cap`}
                        </Badge>
                      </>
                    ) : (
                      <span className="text-sm text-slate-600">Enter fabric used</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
              Select a recipe and enter a valid batch quantity to see the expected count for every component.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
