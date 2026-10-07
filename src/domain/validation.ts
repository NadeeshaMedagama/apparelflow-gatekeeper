import { z } from "zod";
import { countDecimalPlaces } from "./decimal";
import { FABRIC_ROLL_ID_PATTERN, LIMITS } from "./limits";
import { ORDER_STATUSES, REJECTION_CATEGORIES } from "./order-status";

/**
 * Request schemas shared by the browser forms and the API.
 *
 * Deliberately strict:
 *  - numbers must arrive as JSON numbers; numeric strings ("50") are rejected,
 *    so there is no coercion of "", " ", null or "1e3" into a quantity;
 *  - piece counts and batch quantities must be whole numbers;
 *  - unknown keys (e.g. "status", "verifierId") are rejected, so a tampered
 *    payload fails loudly instead of being silently half-applied.
 */

const nf = new Intl.NumberFormat("en-US");

function numberField(label: string) {
  return z.number({
    error: (issue) => (issue.input === undefined || issue.input === null ? `${label} is required` : `${label} must be a number`),
  });
}

function wholeNumberField(label: string, min: number, max: number, minMessage: string) {
  return numberField(label)
    .int({ error: `${label} must be a whole number` })
    .min(min, { error: minMessage })
    .max(max, { error: `${label} cannot exceed ${nf.format(max)}` });
}

export const uuidSchema = z.uuid({ error: "Must be a valid identifier" });

export const targetQtySchema = wholeNumberField(
  "Target batch quantity",
  LIMITS.targetQty.min,
  LIMITS.targetQty.max,
  "Target batch quantity must be at least 1 garment",
);

export const componentCountSchema = wholeNumberField(
  "Count",
  LIMITS.componentCount.min,
  LIMITS.componentCount.max,
  "Count cannot be negative",
);

export const fabricYardsSchema = numberField("Actual fabric used")
  .min(LIMITS.fabricYards.min, { error: "Actual fabric used must be greater than 0 yards" })
  .max(LIMITS.fabricYards.max, { error: `Actual fabric used cannot exceed ${nf.format(LIMITS.fabricYards.max)} yards` })
  .refine((value) => countDecimalPlaces(value) <= LIMITS.fabricYards.decimals, {
    error: `Actual fabric used can have at most ${LIMITS.fabricYards.decimals} decimal places`,
  });

export const fabricRollIdSchema = z
  .string({
    error: (issue) => (issue.input === undefined || issue.input === null ? "Fabric roll ID is required" : "Fabric roll ID must be text"),
  })
  .trim()
  .toUpperCase()
  .min(1, { error: "Fabric roll ID is required" })
  .min(LIMITS.fabricRollId.min, { error: `Fabric roll ID must be at least ${LIMITS.fabricRollId.min} characters` })
  .max(LIMITS.fabricRollId.max, { error: `Fabric roll ID cannot exceed ${LIMITS.fabricRollId.max} characters` })
  .regex(FABRIC_ROLL_ID_PATTERN, { error: "Use letters, digits and single hyphens only (e.g. FAB-ROLL-882)" });

export const createCuttingOrderSchema = z.strictObject({
  recipeId: z.uuid({ error: "Select a recipe" }),
  targetQty: targetQtySchema,
  fabricRollId: fabricRollIdSchema,
  actualFabricYds: fabricYardsSchema,
  submitForVerification: z.boolean({ error: "submitForVerification must be true or false" }).optional(),
});
export type CreateCuttingOrderInput = z.infer<typeof createCuttingOrderSchema>;

export const updateCuttingOrderSchema = z
  .strictObject({
    targetQty: targetQtySchema.optional(),
    fabricRollId: fabricRollIdSchema.optional(),
    actualFabricYds: fabricYardsSchema.optional(),
  })
  .refine(
    (value) => value.targetQty !== undefined || value.fabricRollId !== undefined || value.actualFabricYds !== undefined,
    { error: "Provide at least one field to update" },
  );
export type UpdateCuttingOrderInput = z.infer<typeof updateCuttingOrderSchema>;

export const saveCountsSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        componentId: z.uuid({ error: "componentId must be a valid component identifier" }),
        actualQty: componentCountSchema,
      }),
      { error: "items must be a list of component counts" },
    )
    .min(1, { error: "Provide at least one component count" })
    .max(100, { error: "Too many component counts in one request" })
    .refine((items) => new Set(items.map((item) => item.componentId)).size === items.length, {
      error: "Each component may only appear once per request",
    }),
});
export type SaveCountsInput = z.infer<typeof saveCountsSchema>;

export const approveBatchSchema = z.strictObject({
  note: z
    .string({ error: "note must be text" })
    .trim()
    .max(LIMITS.approvalNote.max, { error: `Approval note cannot exceed ${LIMITS.approvalNote.max} characters` })
    .optional(),
});
export type ApproveBatchInput = z.infer<typeof approveBatchSchema>;

export const rejectBatchSchema = z.strictObject({
  reason: z
    .string({
      error: (issue) =>
        issue.input === undefined || issue.input === null ? "A rejection reason is required" : "The rejection reason must be text",
    })
    .trim()
    .min(1, { error: "A rejection reason is required" })
    .min(LIMITS.rejectionReason.min, {
      error: `Describe the defect in at least ${LIMITS.rejectionReason.min} characters`,
    })
    .max(LIMITS.rejectionReason.max, {
      error: `The rejection reason cannot exceed ${LIMITS.rejectionReason.max} characters`,
    }),
  category: z.enum(REJECTION_CATEGORIES, { error: "Select a valid rejection category" }).optional(),
});
export type RejectBatchInput = z.infer<typeof rejectBatchSchema>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const loginSchema = z.strictObject({
  email: z
    .string({ error: "Email is required" })
    .trim()
    .toLowerCase()
    .min(1, { error: "Email is required" })
    .max(254, { error: "Email is too long" })
    .regex(EMAIL_PATTERN, { error: "Enter a valid email address" }),
  password: z
    .string({ error: "Password is required" })
    .min(1, { error: "Password is required" })
    .max(200, { error: "Password is too long" }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const orderStatusFilterSchema = z.enum(ORDER_STATUSES, { error: "Unknown order status filter" });

/**
 * Body schema for state-transition actions (submit, re-cut, start sewing).
 * They take no input; any field — e.g. a smuggled "status" — is rejected.
 */
export const emptyActionSchema = z.strictObject({});

/**
 * Strict parser for text typed into a quantity input. Used by forms before a
 * value is ever turned into a number, so "", " ", "1.5", "-3", "1e3" and
 * "abc" produce a precise inline error instead of a silently coerced value.
 */
export function parseWholeNumberInput(
  raw: string,
  options: { label: string; min: number; max: number },
): { ok: true; value: number } | { ok: false; error: string } {
  const text = raw.trim();
  if (text === "") return { ok: false, error: `${options.label} is required` };
  if (/^-\d/.test(text)) return { ok: false, error: `${options.label} cannot be negative` };
  if (/^\d+[.,]\d*$/.test(text)) return { ok: false, error: `${options.label} must be a whole number` };
  if (!/^\d+$/.test(text)) return { ok: false, error: `${options.label} must contain digits only` };
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value > options.max) {
    return { ok: false, error: `${options.label} cannot exceed ${nf.format(options.max)}` };
  }
  if (value < options.min) {
    return {
      ok: false,
      error: options.min === 1 ? `${options.label} must be at least 1` : `${options.label} must be at least ${options.min}`,
    };
  }
  return { ok: true, value };
}

/** Strict parser for decimal text (fabric yards). */
export function parseDecimalInput(
  raw: string,
  options: { label: string; min: number; max: number; decimals: number },
): { ok: true; value: number } | { ok: false; error: string } {
  const text = raw.trim();
  if (text === "") return { ok: false, error: `${options.label} is required` };
  if (/^-/.test(text)) return { ok: false, error: `${options.label} cannot be negative` };
  if (!/^\d+(\.\d+)?$/.test(text)) return { ok: false, error: `${options.label} must be a number (e.g. 92.5)` };
  if (countDecimalPlaces(text) > options.decimals) {
    return { ok: false, error: `${options.label} can have at most ${options.decimals} decimal places` };
  }
  const value = Number(text);
  if (value < options.min) return { ok: false, error: `${options.label} must be greater than 0` };
  if (value > options.max) return { ok: false, error: `${options.label} cannot exceed ${nf.format(options.max)}` };
  return { ok: true, value };
}
