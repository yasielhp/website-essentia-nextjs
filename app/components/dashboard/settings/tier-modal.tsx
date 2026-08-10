"use client";

import { useState, useEffect, useRef, useReducer } from "react";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import type { ModalState } from "@/types/settings";
import { IconX } from "@/components/ui/icons";
import { TierFields } from "./tier-fields";
import { discountFromPrices, formReducer } from "./tier-form-state";

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
  const t = useTranslations("dashboard.settings.tiers");
  const tCommon = useTranslations("dashboard.common");

  const [form, dispatchForm] = useReducer(formReducer, {
    duration:
      modal.tier?.duration_minutes != null
        ? String(modal.tier.duration_minutes)
        : "",
    priceWeb: modal.tier?.price_eur != null ? String(modal.tier.price_eur) : "",
    priceCenter:
      modal.tier?.price_center_eur != null
        ? String(modal.tier.price_center_eur)
        : "",
    priceSuite:
      modal.tier?.price_suite_eur != null
        ? String(modal.tier.price_suite_eur)
        : "",
    discount: discountFromPrices(
      modal.tier?.price_center_eur != null
        ? String(modal.tier.price_center_eur)
        : "",
      modal.tier?.price_eur != null ? String(modal.tier.price_eur) : "",
    ),
    color: modal.tier?.color ?? "#6b7280",
    active: modal.tier?.active ?? true,
  });

  const [staffIds, setStaffIds] = useState<string[]>([]);
  // Saving rewrites the assignments wholesale, so it must not run before they
  // have been read: an empty list is indistinguishable from "unassign all".
  /**
   * Whether the assigned staff came back from the server.
   *
   * A ref, not state: it is read when saving and never rendered, so the extra
   * render it caused bought nothing.
   */
  const staffLoadedRef = useRef(false);

  useEffect(() => {
    const tierId = modal.tier?.id;
    if (!tierId) return;

    let cancelled = false;

    async function loadAssignments() {
      const { data } = await insforge.database
        .from("staff_tiers")
        .select("staff_id, sort_order")
        .eq("tier_id", tierId)
        .order("sort_order");

      if (cancelled) return;

      setStaffIds(
        ((data ?? []) as { staff_id: string }[]).map((r) => r.staff_id),
      );
      staffLoadedRef.current = true;
    }
    void loadAssignments();

    return () => {
      cancelled = true;
    };
  }, [modal.tier?.id]);

  // Colours already spoken for, so the clash is caught while picking rather
  // than on save. The unique index is the real guard; this is the manners.
  const [takenColors, setTakenColors] = useState<Record<string, string>>({});

  useEffect(() => {
    const tierId = modal.tier?.id;

    let cancelled = false;

    async function loadColors() {
      const { data } = await insforge.database
        .from("service_tiers")
        .select("id, label, color");

      if (cancelled) return;

      const taken: Record<string, string> = {};
      for (const row of (data ?? []) as {
        id: string;
        label: string | null;
        color: string | null;
      }[]) {
        if (!row.color || row.id === tierId) continue;
        taken[row.color.toLowerCase()] = row.label ?? "—";
      }
      setTakenColors(taken);
    }
    void loadColors();

    return () => {
      cancelled = true;
    };
  }, [modal.tier?.id]);

  const colorClash = takenColors[form.color.toLowerCase()] ?? null;

  const [ops, setOps] = useState({ saving: false });
  const { saving } = ops;

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
    if (colorClash) return;
    setOps((o) => ({ ...o, saving: true }));
    const payload = {
      duration_minutes:
        form.duration !== "" ? parseInt(form.duration, 10) : null,
      // `price_eur` is the amount the public booking flow charges; it was
      // never written from here, so editing prices left the website on the
      // seeded figure.
      price_eur: form.priceWeb !== "" ? parseFloat(form.priceWeb) : null,
      price_center_eur:
        form.priceCenter !== "" ? parseFloat(form.priceCenter) : null,
      price_suite_eur:
        form.priceSuite !== "" ? parseFloat(form.priceSuite) : null,
      color: form.color || null,
      active: form.active,
    };

    if (modal.tier) {
      const tierId = modal.tier.id;
      await insforge.database
        .from("service_tiers")
        .update(payload)
        .eq("id", tierId);

      // Replace the assignments wholesale: the set is small and a diff would
      // buy nothing but a chance to leave a stale row behind.
      if (staffLoadedRef.current) {
        await insforge.database
          .from("staff_tiers")
          .delete()
          .eq("tier_id", tierId);
      }
      if (staffLoadedRef.current && staffIds.length > 0) {
        await insforge.database.from("staff_tiers").insert(
          // The position in the list is the position in the booking form.
          staffIds.map((staff_id, index) => ({
            staff_id,
            tier_id: tierId,
            sort_order: index,
          })),
        );
      }
    }

    await onSaved(modal.serviceId);
    setOps((o) => ({ ...o, saving: false }));
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
            {modal.tier?.label ?? t("editTier")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            className="text-petroleum-300 hover:text-petroleum-500 transition-colors"
          >
            <IconX />
          </button>
        </div>

        {/* Body */}
        <TierFields
          form={form}
          dispatchForm={dispatchForm}
          colorClash={colorClash}
          staffIds={staffIds}
          onStaffChange={setStaffIds}
        />

        {/* Footer */}
        <div className="border-sand-100 flex items-center justify-between border-t px-6 py-4">
          <div></div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="border-sand-200 text-petroleum-500 hover:bg-sand-50 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              disabled={saving || !!colorClash}
              onClick={() => void handleSave()}
              className="bg-petroleum-700 hover:bg-petroleum-800 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              {saving ? t("saving") : t("update")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
