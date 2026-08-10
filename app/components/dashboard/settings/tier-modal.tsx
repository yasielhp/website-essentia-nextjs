"use client";

import { useState, useEffect, useRef, useReducer } from "react";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { INPUT_CLASS } from "@/constants/form-styles";
import type { ModalState } from "@/types/settings";
import { IconX } from "@/components/ui/icons";
import { TierStaffPicker } from "@/components/dashboard/settings/tier-staff-picker";

// ─── Prices ───────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The web price is the centre price minus the online discount.
 *
 * The percentage is not stored: it is whatever the two prices say, so the
 * discount shown on the website can never disagree with what is charged.
 */
function webFromCentre(centre: string, discount: string): string {
  const c = parseFloat(centre);
  const d = parseFloat(discount);
  if (!isFinite(c) || !isFinite(d)) return "";
  return String(round2(c * (1 - d / 100)));
}

function discountFromPrices(centre: string, web: string): string {
  const c = parseFloat(centre);
  const w = parseFloat(web);
  if (!isFinite(c) || !isFinite(w) || c <= 0) return "";
  return String(round2((1 - w / c) * 100));
}

// ─── Form state reducer ───────────────────────────────────────

type FormState = {
  duration: string;
  priceWeb: string;
  priceCenter: string;
  priceSuite: string;
  /** Percentage off the centre price for booking online. */
  discount: string;
  color: string;
  active: boolean;
};

type FormAction =
  | { type: "SET_DURATION"; duration: string }
  | { type: "SET_PRICE_WEB"; price: string }
  | { type: "SET_PRICE_CENTER"; price: string }
  | { type: "SET_PRICE_SUITE"; price: string }
  | { type: "SET_DISCOUNT"; discount: string }
  | { type: "SET_COLOR"; color: string }
  | { type: "TOGGLE_ACTIVE" };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_DURATION":
      return { ...state, duration: action.duration };
    case "SET_PRICE_WEB":
      return {
        ...state,
        priceWeb: action.price,
        discount: discountFromPrices(state.priceCenter, action.price),
      };
    case "SET_PRICE_CENTER":
      return {
        ...state,
        priceCenter: action.price,
        // A discount already set is a rule, not a one-off: moving the centre
        // price moves the web price with it.
        priceWeb:
          state.discount !== ""
            ? webFromCentre(action.price, state.discount)
            : state.priceWeb,
      };
    case "SET_DISCOUNT":
      return {
        ...state,
        discount: action.discount,
        priceWeb:
          webFromCentre(state.priceCenter, action.discount) || state.priceWeb,
      };
    case "SET_PRICE_SUITE":
      return { ...state, priceSuite: action.price };
    case "SET_COLOR":
      return { ...state, color: action.color };
    case "TOGGLE_ACTIVE":
      return { ...state, active: !state.active };
    default:
      return state;
  }
}

/**
 * A number with its unit inside the box.
 *
 * The unit used to live in the label — "Duración (min)", "Precio — Centro (€)"
 * — which reads as part of the field's name rather than of its value, and made
 * three price labels wrap in a modal this narrow.
 */
function NumberField({
  id,
  label,
  suffix,
  value,
  onChange,
  placeholder,
  step = "1",
  max,
}: {
  id: string;
  label: string;
  suffix: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  step?: string;
  max?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-petroleum-500 text-xs font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          min="0"
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${INPUT_CLASS} pr-16`}
        />
        {/* Divided off so the unit reads as a unit, not as part of the value. */}
        <span className="border-sand-200 text-petroleum-300 pointer-events-none absolute inset-y-px right-px flex items-center rounded-r-xl border-l px-3 text-xs font-medium tracking-wide uppercase">
          {suffix}
        </span>
      </div>
    </div>
  );
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
  const [staffLoaded, setStaffLoaded] = useState(false);

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
      setStaffLoaded(true);
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

  const centreValue = parseFloat(form.priceCenter);
  const webValue = parseFloat(form.priceWeb);
  const saving_eur =
    isFinite(centreValue) && isFinite(webValue) && centreValue > webValue
      ? round2(centreValue - webValue)
      : null;

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
      if (staffLoaded) {
        await insforge.database
          .from("staff_tiers")
          .delete()
          .eq("tier_id", tierId);
      }
      if (staffLoaded && staffIds.length > 0) {
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
            onClick={onClose}
            aria-label={tCommon("close")}
            className="text-petroleum-300 hover:text-petroleum-500 transition-colors"
          >
            <IconX />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Active — first */}
          <div className="flex items-center justify-between">
            <span
              id="tier-active-caption"
              className="text-petroleum-700 text-sm font-medium"
            >
              {t("active")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.active}
              aria-labelledby="tier-active-caption"
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

          <NumberField
            id="tier-duration"
            label={t("duration")}
            suffix="min"
            value={form.duration}
            onChange={(duration) =>
              dispatchForm({ type: "SET_DURATION", duration })
            }
            placeholder={t("durationPlaceholder")}
          />

          <div className="grid grid-cols-3 gap-3">
            <NumberField
              id="tier-price-web"
              label={t("priceWeb")}
              suffix="€"
              step="0.01"
              value={form.priceWeb}
              onChange={(price) =>
                dispatchForm({ type: "SET_PRICE_WEB", price })
              }
              placeholder={t("priceWebPlaceholder")}
            />
            <NumberField
              id="tier-price-center"
              label={t("priceCentre")}
              suffix="€"
              step="0.01"
              value={form.priceCenter}
              onChange={(price) =>
                dispatchForm({ type: "SET_PRICE_CENTER", price })
              }
              placeholder={t("priceCentrePlaceholder")}
            />
            <NumberField
              id="tier-price-suite"
              label={t("priceSuite")}
              suffix="€"
              step="0.01"
              value={form.priceSuite}
              onChange={(price) =>
                dispatchForm({ type: "SET_PRICE_SUITE", price })
              }
              placeholder={t("priceSuitePlaceholder")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <NumberField
              id="tier-discount"
              label={t("discount")}
              suffix="%"
              max="100"
              value={form.discount}
              onChange={(discount) =>
                dispatchForm({ type: "SET_DISCOUNT", discount })
              }
              placeholder="0"
            />
            {/* Only when there is something to say: with no discount set the
                line was explaining the field's own name. */}
            {saving_eur != null && (
              <p className="text-petroleum-300 text-xs">
                {t("discountSaving", {
                  amount: saving_eur,
                  centre: form.priceCenter,
                  web: form.priceWeb,
                })}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-petroleum-500 text-xs font-medium">
              {t("staffHeading")}
            </span>
            <TierStaffPicker selected={staffIds} onChange={setStaffIds} />
          </div>

          <div className="flex flex-col gap-1.5">
            {/* The label is the colour swatch, so it has no text of its own;
                the caption beside it is what names the control. */}
            <span
              id="tier-color-caption"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("calendarColor")}
            </span>
            <label
              htmlFor="tier-color"
              className="border-sand-200 relative block h-11 cursor-pointer overflow-hidden rounded-xl border"
              style={{ backgroundColor: form.color }}
            >
              <input
                id="tier-color"
                aria-labelledby="tier-color-caption"
                type="color"
                value={form.color}
                onChange={(e) =>
                  dispatchForm({ type: "SET_COLOR", color: e.target.value })
                }
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            {colorClash && (
              <p className="text-xs text-red-600">
                {t("colorTaken", { label: colorClash })}
              </p>
            )}
          </div>
        </div>

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
