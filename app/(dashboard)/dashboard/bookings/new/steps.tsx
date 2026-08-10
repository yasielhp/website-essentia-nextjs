"use client";

import { type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { ServicePicker } from "@/components/ui/service-picker";
import { TierPicker } from "@/components/ui/tier-picker";
import { StaffSelect } from "@/components/ui/staff-select";
import type { TierStaff } from "@/actions/tier-staff";
import type { DashboardLocation } from "../_shared/location-options";
import { CompletedRow } from "./completed-row";
import {
  toTierOption,
  type FormAction,
  type Service,
  type Tier,
} from "./form-state";

/**
 * The three steps that are a picker and little else: what service, which
 * session type, and who performs it.
 *
 * Each answers, then folds itself into a one-line summary so the step below it
 * has the screen — which is why every one of them is really two renderings.
 */

function useServicePickerLabels() {
  const t = useTranslations("dashboard.bookings.form.servicePicker");
  return {
    placeholder: t("placeholder"),
    modalTitle: t("modalTitle"),
    close: t("close"),
    wellness: t("wellness"),
    medicine: t("medicine"),
  };
}

function useTierPickerLabels() {
  const t = useTranslations("dashboard.bookings.form.tierPicker");
  return {
    fieldLabel: t("fieldLabel"),
    placeholder: t("placeholder"),
    modalTitle: t("modalTitle"),
    close: t("close"),
    standard: t("standard"),
  };
}

export function ServiceStep({
  services,
  loading,
  selectedService,
  editing,
  onEdit,
  onDone,
  dispatchForm,
}: {
  services: Service[];
  loading: boolean;
  selectedService: Service | null;
  /** True while this step is the one being answered. */
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  dispatchForm: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.bookings.form");
  const labels = useServicePickerLabels();

  if (selectedService && !editing) {
    return (
      <CompletedRow
        label={t("steps.service")}
        value={selectedService.title}
        onEdit={onEdit}
      />
    );
  }

  // Manual therapies first — it is the one most bookings are for — and the rest
  // by name, so the list does not reshuffle as services are added.
  const sorted = services.toSorted((a, b) => {
    if (a.id === "manual-therapies") return -1;
    if (b.id === "manual-therapies") return 1;
    return a.title.localeCompare(b.title);
  });

  return (
    <div className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("steps.service")}
      </h2>
      {loading ? (
        <div className="border-sand-200 bg-sand-50 h-16 animate-pulse rounded-2xl border" />
      ) : (
        <ServicePicker
          options={sorted}
          selected={selectedService}
          onSelect={(s) => {
            dispatchForm({ type: "SET_SERVICE", id: s.id });
            onDone();
          }}
          labels={labels}
        />
      )}
    </div>
  );
}

export function TierStep({
  tiers,
  loading,
  tierId,
  selectedTier,
  location,
  editing,
  onEdit,
  onDone,
  dispatchForm,
}: {
  tiers: Tier[];
  loading: boolean;
  tierId: string;
  selectedTier: Tier | null;
  /** Prices differ by place, so the picker needs to know where. */
  location: DashboardLocation | "";
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  dispatchForm: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.bookings.form");
  const labels = useTierPickerLabels();

  if (tierId && !editing) {
    return (
      <CompletedRow
        label={t("steps.sessionType")}
        value={
          selectedTier
            ? [
                selectedTier.label,
                selectedTier.duration_minutes != null
                  ? `${selectedTier.duration_minutes} min`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : ""
        }
        onEdit={onEdit}
      />
    );
  }

  return (
    <div className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("steps.sessionType")}
      </h2>
      {loading ? (
        <div className="border-sand-200 bg-sand-50 h-18.5 animate-pulse rounded-2xl border" />
      ) : tiers.length === 0 ? (
        <p className="text-petroleum-300 border-sand-200 rounded-xl border border-dashed px-4 py-3 text-sm">
          {t("noTiers")}
        </p>
      ) : (
        <TierPicker
          options={tiers.map((tier) => toTierOption(tier, location))}
          selectedId={tierId}
          labels={labels}
          collapseSingle
          onSelect={(o) => {
            dispatchForm({ type: "SET_TIER", id: o.id });
            onDone();
          }}
        />
      )}
    </div>
  );
}

export function StaffStep({
  staffId,
  tierStaff,
  dispatchForm,
}: {
  staffId: string;
  tierStaff: TierStaff[];
  dispatchForm: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.bookings.form");
  const tCommon = useTranslations("dashboard.common");

  return (
    <div className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("steps.staff")}
      </h2>
      <StaffSelect
        options={tierStaff}
        selected={staffId || null}
        onSelect={(person) =>
          dispatchForm({ type: "SET_STAFF", value: person.id })
        }
        labels={{
          fieldLabel: t("steps.staff"),
          placeholder: t("staff.placeholder"),
          modalTitle: t("steps.staff"),
          close: tCommon("cancel"),
        }}
      />
    </div>
  );
}
