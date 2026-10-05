"use client";

import { Plus, Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { createCuttingOrderSchema } from "@/domain/validation";
import { apiRequest, ApiRequestError } from "@/lib/api-client";
import type { CuttingOrderDetailDTO, RecipeDTO } from "@/lib/dto";
import { OrderFormFields, parseOrderForm, type OrderField, type OrderFormValues } from "./order-form-fields";

const EMPTY: OrderFormValues = { recipeId: "", targetQty: "", fabricRollId: "", actualFabricYds: "" };

export function CreateOrderDialog({ recipes }: { recipes: RecipeDTO[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<OrderFormValues>(EMPTY);
  const [serverErrors, setServerErrors] = useState<Partial<Record<OrderField, string>>>({});
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"draft" | "submit" | null>(null);

  function reset() {
    setValues(EMPTY);
    setServerErrors({});
    setShowAllErrors(false);
    setFormError(null);
  }

  function change(field: OrderField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setServerErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(mode: "draft" | "submit") {
    setShowAllErrors(true);
    setFormError(null);
    const parsed = parseOrderForm(values, recipes);
    if (!parsed.valid || !parsed.data) {
      setFormError("Please correct the highlighted fields.");
      const first = (["recipeId", "targetQty", "fabricRollId", "actualFabricYds"] as const).find((field) => parsed.errors[field]);
      if (first) document.getElementById(first)?.focus();
      return;
    }
    // Same schema the API enforces — the client check is a convenience, not the boundary.
    const payload = createCuttingOrderSchema.safeParse({ ...parsed.data, submitForVerification: mode === "submit" });
    if (!payload.success) {
      setFormError(payload.error.issues[0]?.message ?? "Invalid order details.");
      return;
    }

    setSubmitting(mode);
    try {
      const order = await apiRequest<CuttingOrderDetailDTO>("/api/cutting-orders", { method: "POST", body: payload.data });
      toast.success(`${order.orderNo} created`, {
        description: mode === "submit" ? "Submitted to the QC station for verification." : "Saved as cutting in progress.",
      });
      setOpen(false);
      reset();
      router.push(`/cutting/orders/${order.id}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setServerErrors(error.fieldErrors as Partial<Record<OrderField, string>>);
        setFormError(error.message);
      } else {
        setFormError("Could not create the order. Please try again.");
      }
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} icon={<Plus className="size-4" aria-hidden="true" />} data-testid="open-create-order">
        New cutting order
      </Button>
      <Modal
        open={open}
        onClose={() => {
          if (submitting) return;
          setOpen(false);
          reset();
        }}
        closeDisabled={submitting !== null}
        size="xl"
        title="New cutting order"
        description="Log the batch from the cutting table. Expected component counts are derived from the recipe automatically."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={submitting !== null}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => submit("draft")}
              loading={submitting === "draft"}
              disabled={submitting !== null}
              icon={<Save className="size-4" aria-hidden="true" />}
            >
              Save as in cutting
            </Button>
            <Button
              onClick={() => submit("submit")}
              loading={submitting === "submit"}
              disabled={submitting !== null}
              icon={<Send className="size-4" aria-hidden="true" />}
            >
              Create &amp; submit to QC
            </Button>
          </>
        }
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit("submit");
          }}
          className="space-y-5"
        >
          {formError ? (
            <Alert tone="danger" role="alert" title="Order not created">
              {formError}
            </Alert>
          ) : null}
          <OrderFormFields
            recipes={recipes}
            values={values}
            onChange={change}
            serverErrors={serverErrors}
            showAllErrors={showAllErrors}
          />
          <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
        </form>
      </Modal>
    </>
  );
}
