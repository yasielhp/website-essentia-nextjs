"use client";

import { useReducer, useEffect, useRef } from "react";
import { insforge } from "@/lib/insforge";
import { INPUT_CLASS } from "@/constants/form-styles";
import type { PlanRow } from "@/types/settings";
import { IconX } from "@/components/ui/icons";

type FormState = { label: string; price: string; saving: boolean };
type FormAction =
  | { type: "SET_LABEL"; label: string }
  | { type: "SET_PRICE"; price: string }
  | { type: "SAVING_START" }
  | { type: "SAVING_END" };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_LABEL":
      return { ...state, label: action.label };
    case "SET_PRICE":
      return { ...state, price: action.price };
    case "SAVING_START":
      return { ...state, saving: true };
    case "SAVING_END":
      return { ...state, saving: false };
  }
}

export function PlanModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: PlanRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, dispatch] = useReducer(formReducer, {
    label: plan.label,
    price: plan.price_monthly != null ? String(plan.price_monthly) : "",
    saving: false,
  });
  const overlayRef = useRef<HTMLDivElement>(null);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    dispatch({ type: "SAVING_START" });
    await insforge.database
      .from("membership_plans")
      .update({
        label: form.label.trim() || plan.label,
        price_monthly: form.price !== "" ? parseFloat(form.price) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan.id);
    await onSaved();
    dispatch({ type: "SAVING_END" });
    onClose();
  }

  return (
    <div
      ref={overlayRef}
      role="presentation"
      onClick={handleOverlayClick}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <div className="border-sand-200 mx-4 w-full max-w-sm rounded-2xl border bg-white shadow-xl">
        {/* Header */}
        <div className="border-sand-100 flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-petroleum-700 font-semibold">Edit plan</h3>
          <button
            onClick={onClose}
            className="text-petroleum-300 hover:text-petroleum-500 transition-colors"
          >
            <IconX />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="plan-label"
              className="text-petroleum-500 text-xs font-medium"
            >
              Name
            </label>
            <input
              id="plan-label"
              type="text"
              value={form.label}
              onChange={(e) =>
                dispatch({ type: "SET_LABEL", label: e.target.value })
              }
              placeholder="e.g. Essential"
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="plan-price"
              className="text-petroleum-500 text-xs font-medium"
            >
              Monthly price (€)
            </label>
            <input
              id="plan-price"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) =>
                dispatch({ type: "SET_PRICE", price: e.target.value })
              }
              placeholder="199"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-sand-100 flex items-center justify-end gap-3 border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="border-sand-200 text-petroleum-500 hover:bg-sand-50 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={form.saving}
            onClick={() => void handleSave()}
            className="bg-petroleum-700 hover:bg-petroleum-800 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {form.saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
