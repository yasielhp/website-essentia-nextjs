"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { bookableServices } from "@/data/services-data";
import { IconX } from "@/components/ui/icons";

export type CalendarFilters = {
  staffId: string;
  serviceId: string;
  tierId: string;
};

export const EMPTY_FILTERS: CalendarFilters = {
  staffId: "",
  serviceId: "",
  tierId: "",
};

export function activeFilterCount(filters: CalendarFilters): number {
  return Object.values(filters).filter(Boolean).length;
}

const FIELD_CLASS =
  "border-sand-200 text-petroleum-700 focus:border-petroleum-400 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none";

/**
 * The calendar's three filters, behind a button.
 *
 * Edits are held locally and only applied on confirm: changing a select
 * refetches the month, and picking staff, then service, then session type
 * would otherwise cost three round trips to express one question.
 */
export function CalendarFiltersModal({
  filters,
  staffOptions,
  tierOptions,
  onApply,
  onClose,
}: {
  filters: CalendarFilters;
  staffOptions: { id: string; name: string }[];
  tierOptions: { id: string; label: string; service_id: string }[];
  onApply: (next: CalendarFilters) => void;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard.calendar.filters");
  const tServices = useTranslations("dashboard.services");
  const tCommon = useTranslations("dashboard.common");

  const [draft, setDraft] = useState<CalendarFilters>(filters);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      role="presentation"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <div className="border-sand-200 mx-4 w-full max-w-sm rounded-2xl border bg-white shadow-xl">
        <div className="border-sand-100 flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-petroleum-700 font-semibold">{t("title")}</h3>
          <button
            onClick={onClose}
            aria-label={tCommon("close")}
            className="text-petroleum-300 hover:text-petroleum-500 transition-colors"
          >
            <IconX />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="filter-staff"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("staff")}
            </label>
            <select
              id="filter-staff"
              value={draft.staffId}
              onChange={(e) =>
                setDraft((d) => ({ ...d, staffId: e.target.value }))
              }
              className={FIELD_CLASS}
            >
              <option value="">{t("allStaff")}</option>
              {staffOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="filter-service"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("service")}
            </label>
            <select
              id="filter-service"
              value={draft.serviceId}
              onChange={(e) =>
                // The chosen session type may belong to another service.
                setDraft((d) => ({
                  ...d,
                  serviceId: e.target.value,
                  tierId: "",
                }))
              }
              className={FIELD_CLASS}
            >
              <option value="">{t("allServices")}</option>
              {bookableServices.map(({ id }) => (
                <option key={id} value={id}>
                  {tServices(id)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="filter-tier"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("tier")}
            </label>
            <select
              id="filter-tier"
              value={draft.tierId}
              onChange={(e) =>
                setDraft((d) => ({ ...d, tierId: e.target.value }))
              }
              className={FIELD_CLASS}
            >
              <option value="">{t("allTiers")}</option>
              {/* Filtered and rendered in one pass. */}
              {tierOptions.flatMap((tier) =>
                !draft.serviceId || tier.service_id === draft.serviceId
                  ? [
                      <option key={tier.id} value={tier.id}>
                        {tier.label}
                      </option>,
                    ]
                  : [],
              )}
            </select>
          </div>
        </div>

        <div className="border-sand-100 flex items-center justify-between border-t px-6 py-4">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_FILTERS)}
            disabled={activeFilterCount(draft) === 0}
            className="text-petroleum-400 hover:text-petroleum-700 text-sm transition-colors disabled:opacity-40"
          >
            {t("clear")}
          </button>
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
              onClick={() => onApply(draft)}
              className="bg-petroleum-700 hover:bg-petroleum-800 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              {t("apply")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
