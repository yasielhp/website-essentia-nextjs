"use client";

import { useState, useEffect, useRef, useReducer } from "react";
import { insforge } from "@/lib/insforge";
import { INPUT_CLASS } from "@/constants/form-styles";
import type { ModalState } from "@/types/settings";

// ─── Form state reducer ───────────────────────────────────────

type FormState = {
  label: string;
  duration: string;
  price: string;
  color: string;
  active: boolean;
};

type FormAction =
  | { type: "SET_LABEL"; label: string }
  | { type: "SET_DURATION"; duration: string }
  | { type: "SET_PRICE"; price: string }
  | { type: "SET_COLOR"; color: string }
  | { type: "TOGGLE_ACTIVE" };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_LABEL":
      return { ...state, label: action.label };
    case "SET_DURATION":
      return { ...state, duration: action.duration };
    case "SET_PRICE":
      return { ...state, price: action.price };
    case "SET_COLOR":
      return { ...state, color: action.color };
    case "TOGGLE_ACTIVE":
      return { ...state, active: !state.active };
    default:
      return state;
  }
}

// ─── Component ────────────────────────────────────────────────

export function TierModal({
  modal,
  onClose,
  onSaved,
}: {
  modal: ModalState;
  onClose: () => void;
  onSaved: (serviceId: string) => Promise<void>;
}) {
  const isEdit = !!modal.tier;

  const [form, dispatchForm] = useReducer(formReducer, {
    label: modal.tier?.label ?? "",
    duration:
      modal.tier?.duration_minutes != null
        ? String(modal.tier.duration_minutes)
        : "",
    price: modal.tier?.price_eur != null ? String(modal.tier.price_eur) : "",
    color: modal.tier?.color ?? "#6b7280",
    active: modal.tier?.active ?? true,
  });

  const [ops, setOps] = useState({ saving: false, deleting: false });
  const { saving, deleting } = ops;

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
    setOps((o) => ({ ...o, saving: true }));
    if (isEdit && modal.tier) {
      await insforge.database
        .from("service_tiers")
        .update({
          label: form.label.trim() || null,
          duration_minutes:
            form.duration !== "" ? parseInt(form.duration, 10) : null,
          price_eur: form.price !== "" ? parseFloat(form.price) : null,
          color: form.color || null,
          active: form.active,
        })
        .eq("id", modal.tier.id);
    } else {
      const existing = await insforge.database
        .from("service_tiers")
        .select("id", { count: "exact", head: true })
        .eq("service_id", modal.serviceId);
      const nextOrder = existing.count ?? 0;
      await insforge.database.from("service_tiers").insert([
        {
          service_id: modal.serviceId,
          label: form.label.trim() || null,
          duration_minutes:
            form.duration !== "" ? parseInt(form.duration, 10) : null,
          price_eur: form.price !== "" ? parseFloat(form.price) : null,
          color: form.color || null,
          active: form.active,
          sort_order: nextOrder,
        },
      ]);
    }
    await onSaved(modal.serviceId);
    setOps((o) => ({ ...o, saving: false }));
    onClose();
  }

  async function handleDelete() {
    if (!modal.tier) return;
    setOps((o) => ({ ...o, deleting: true }));
    await insforge.database
      .from("service_tiers")
      .delete()
      .eq("id", modal.tier.id);
    await onSaved(modal.serviceId);
    setOps((o) => ({ ...o, deleting: false }));
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
      <div className="border-sand-200 mx-4 w-full max-w-md rounded-2xl border bg-white shadow-xl">
        {/* Header */}
        <div className="border-sand-100 flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-petroleum-700 font-semibold">
            {isEdit ? "Edit tier" : "Add tier"}
          </h3>
          <button
            onClick={onClose}
            className="text-petroleum-300 hover:text-petroleum-500 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Active — first */}
          <div className="flex items-center justify-between">
            <span className="text-petroleum-700 text-sm font-medium">
              Active
            </span>
            <button
              type="button"
              onClick={() => dispatchForm({ type: "TOGGLE_ACTIVE" })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                form.active ? "bg-petroleum-700" : "bg-sand-200"
              }`}
            >
              <span
                className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
                  form.active ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="border-sand-100 border-t" />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="tier-label"
              className="text-petroleum-500 text-xs font-medium"
            >
              Name
            </label>
            <input
              id="tier-label"
              type="text"
              value={form.label}
              onChange={(e) =>
                dispatchForm({ type: "SET_LABEL", label: e.target.value })
              }
              placeholder="e.g. Standard, 60 min, NAD+"
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="tier-duration"
                className="text-petroleum-500 text-xs font-medium"
              >
                Duration (min)
              </label>
              <input
                id="tier-duration"
                type="number"
                min="0"
                step="1"
                value={form.duration}
                onChange={(e) =>
                  dispatchForm({
                    type: "SET_DURATION",
                    duration: e.target.value,
                  })
                }
                placeholder="60"
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="tier-price"
                className="text-petroleum-500 text-xs font-medium"
              >
                Price (€)
              </label>
              <input
                id="tier-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) =>
                  dispatchForm({ type: "SET_PRICE", price: e.target.value })
                }
                placeholder="80"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-petroleum-500 text-xs font-medium">
              Calendar color
            </span>
            <label className="border-sand-200 flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5">
              <div
                className="size-5 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: form.color }}
              />
              <span className="text-petroleum-400 font-mono text-xs">
                {form.color}
              </span>
              <div
                className="border-sand-200 relative ml-2 size-7 overflow-hidden rounded-lg border"
                style={{ backgroundColor: form.color }}
              >
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) =>
                    dispatchForm({ type: "SET_COLOR", color: e.target.value })
                  }
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
            </label>
          </div>

        </div>

        {/* Footer */}
        <div className="border-sand-100 flex items-center justify-between border-t px-6 py-4">
          <div>
            {isEdit && (
              <button
                type="button"
                disabled={deleting || saving}
                onClick={() => void handleDelete()}
                className="text-sm font-medium text-red-400 transition-colors hover:text-red-600 disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete tier"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="border-sand-200 text-petroleum-500 hover:bg-sand-50 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || deleting}
              onClick={() => void handleSave()}
              className="bg-petroleum-700 hover:bg-petroleum-800 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : isEdit ? "Update" : "Add tier"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
