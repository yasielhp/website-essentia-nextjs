"use client";

import { type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";
import { TierStaffPicker } from "@/components/dashboard/settings/tier-staff-picker";
import { round2 } from "./tier-form-state";
import type { FormAction, FormState } from "./tier-form-state";

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

/**
 * Everything the modal asks about a session type: whether it is on sale, how
 * long it lasts, what it costs in three places, and which colour it wears on
 * the calendar.
 */
export function TierFields({
  form,
  dispatchForm,
  colorClash,
  staffIds,
  onStaffChange,
}: {
  form: FormState;
  dispatchForm: Dispatch<FormAction>;
  /** The other session type already wearing this colour, if any. */
  colorClash: string | null;
  staffIds: string[];
  onStaffChange: (ids: string[]) => void;
}) {
  const t = useTranslations("dashboard.settings.tiers");

  const centreValue = parseFloat(form.priceCenter);
  const webValue = parseFloat(form.priceWeb);
  const saving_eur =
    isFinite(centreValue) && isFinite(webValue) && centreValue > webValue
      ? round2(centreValue - webValue)
      : null;

  return (
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
          onChange={(price) => dispatchForm({ type: "SET_PRICE_WEB", price })}
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
          onChange={(price) => dispatchForm({ type: "SET_PRICE_SUITE", price })}
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
        <TierStaffPicker selected={staffIds} onChange={onStaffChange} />
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
  );
}
