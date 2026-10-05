"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { updateCuttingOrderSchema } from "@/domain/validation";
import { apiRequest, ApiRequestError } from "@/lib/api-client";
import type { CuttingOrderDetailDTO, RecipeDTO } from "@/lib/dto";
import { OrderFormFields, parseOrderForm, type OrderField, type OrderFormValues } from "./order-form-fields";

function initialValues(order: CuttingOrderDetailDTO): OrderFormValues {
  return {
    recipeId: order.recipe.id,
    targetQty: String(order.targetQty),
    fabricRollId: order.fabricRollId,
    actualFabricYds: order.actualFabricYds.toFixed(2),
  };
}

/** Edit quantity / fabric while the batch is still on the cutting table. */
export function EditOrderDialog({
  open,
  onClose,
  order,
  recipe,
}: {
  open: boolean;
  onClose: () => void;
  order: CuttingOrderDetailDTO;
  recipe: RecipeDTO;
}) {
  const router = useRouter();
  const [values, setValues] = useState<OrderFormValues>(() => initialValues(order));
  const [serverErrors, setServerErrors] = useState<Partial<Record<OrderField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function close() {
    if (saving) return;
    setValues(initialValues(order));
    setServerErrors({});
    setFormError(null);
    onClose();
  }

  async function save() {
    setFormError(null);
    const parsed = parseOrderForm(values, [recipe]);
    if (!parsed.valid || !parsed.data) {
      setFormError("Please correct the highlighted fields.");
      return;
    }
    const payload = updateCuttingOrderSchema.safeParse({
      targetQty: parsed.data.targetQty,
      fabricRollId: parsed.data.fabricRollId,
      actualFabricYds: parsed.data.actualFabricYds,
    });
    if (!payload.success) {
      setFormError(payload.error.issues[0]?.message ?? "Invalid order details.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest(`/api/cutting-orders/${order.id}`, { method: "PATCH", body: payload.data });
      toast.success(`${order.orderNo} updated`);
      onClose();
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setServerErrors(error.fieldErrors as Partial<Record<OrderField, string>>);
        setFormError(error.message);
      } else {
        setFormError("Could not save the changes. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      closeDisabled={saving}
      size="xl"
      title={`Edit ${order.orderNo}`}
      description="Batch details can be changed only while cutting is in progress."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} icon={<Save className="size-4" aria-hidden="true" />}>
            Save changes
          </Button>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="space-y-5"
      >
        {formError ? (
          <Alert tone="danger" role="alert" title="Changes not saved">
            {formError}
          </Alert>
        ) : null}
        <OrderFormFields
          recipes={[recipe]}
          values={values}
          onChange={(field, value) => {
            setValues((current) => ({ ...current, [field]: value }));
            setServerErrors((current) => ({ ...current, [field]: undefined }));
          }}
          serverErrors={serverErrors}
          showAllErrors
          lockRecipe
        />
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>
    </Modal>
  );
}
