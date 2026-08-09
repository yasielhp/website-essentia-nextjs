"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { fetchTierStaff, type TierStaff } from "@/actions/tier-staff";
import { StaffSelect } from "@/components/ui/staff-select";
import {
  TierPicker,
  TierSummaryCard,
  type TierPickerOption,
} from "@/components/ui/tier-picker";

type Tier = {
  id: string;
  label: string | null;
  duration_minutes: number | null;
  price_eur: number | null;
  price_center_eur: number | null;
  image_url: string | null;
  color: string | null;
};

/** The picker takes a resolved price; the public flow always pays centre rates. */
function toPickerOption(t: Tier): TierPickerOption {
  return {
    id: t.id,
    label: t.label,
    durationMinutes: t.duration_minutes,
    price: t.price_center_eur ?? t.price_eur,
    imageUrl: t.image_url,
    color: t.color,
  };
}

export type TierSelection = {
  tierId: string;
  label: string | null;
  duration: string | null;
  price: number | null;
};

export function DurationStep({
  serviceId,
  selectedTierId,
  staffId,
  onSelect,
  onSelectStaff,
  preselectedLabel,
}: {
  serviceId: string;
  selectedTierId: string | null;
  staffId: string | null;
  onSelect: (sel: TierSelection) => void;
  onSelectStaff: (person: TierStaff) => void;
  preselectedLabel?: string | null;
}) {
  const tt = useTranslations("booking.durationStep");
  const [tiers, setTiers] = useState<Tier[] | null>(null);
  const [staff, setStaff] = useState<TierStaff[]>([]);

  // Who can perform the chosen session type. Assignments live in the
  // dashboard, so the list changes with the tier, not with the service.
  useEffect(() => {
    let cancelled = false;
    void (
      selectedTierId
        ? fetchTierStaff(selectedTierId)
        : Promise.resolve([] as TierStaff[])
    ).then((people) => {
      if (!cancelled) setStaff(people);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedTierId]);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("service_tiers")
        .select(
          "id, label, duration_minutes, price_eur, price_center_eur, image_url, color",
        )
        .eq("service_id", serviceId)
        .eq("active", true)
        .order("sort_order");
      const rows = (data as Tier[] | null) ?? [];
      setTiers(rows);
      if (rows.length === 1 && rows[0]) {
        const t = rows[0];
        onSelectRef.current({
          tierId: t.id,
          label: t.label,
          duration:
            t.duration_minutes != null ? `${t.duration_minutes} min` : null,
          price: t.price_center_eur ?? t.price_eur,
        });
      } else if (preselectedLabel) {
        const match = rows.find(
          (t) => t.label?.toLowerCase() === preselectedLabel.toLowerCase(),
        );
        if (match) {
          onSelectRef.current({
            tierId: match.id,
            label: match.label,
            duration:
              match.duration_minutes != null
                ? `${match.duration_minutes} min`
                : null,
            price: match.price_center_eur ?? match.price_eur,
          });
        }
      }
    }
    void load();
  }, [serviceId, preselectedLabel]);

  if (tiers === null) {
    return (
      <div className="border-sand-300 bg-sand-50 h-16 animate-pulse rounded-2xl border" />
    );
  }

  if (tiers.length === 0) {
    return <p className="text-petroleum-400 text-sm">{tt("noneAvailable")}</p>;
  }

  const isFixed = tiers.length === 1;
  const options = tiers.map(toPickerOption);

  const pickerLabels = {
    fieldLabel: tt("sessionType"),
    placeholder: tt("selectSessionType"),
    modalTitle: tt("modalTitle"),
    close: tt("close"),
    standard: tt("standard"),
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-petroleum-400 text-sm">
        {isFixed ? tt("fixedDescription") : tt("chooseDescription")}
      </p>
      {isFixed ? (
        <TierSummaryCard option={options[0]!} labels={pickerLabels} />
      ) : (
        <TierPicker
          options={options}
          selectedId={selectedTierId}
          labels={pickerLabels}
          onSelect={(o) =>
            onSelect({
              tierId: o.id,
              label: o.label,
              duration:
                o.durationMinutes != null ? `${o.durationMinutes} min` : null,
              price: o.price,
            })
          }
        />
      )}
      {/* Only once a session type is chosen — the question is about that
          session, and only the people assigned to it can be picked. */}
      {selectedTierId !== null && staff.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-petroleum-400 text-sm">{tt("staffDescription")}</p>
          <StaffSelect
            options={staff}
            selected={staffId}
            onSelect={onSelectStaff}
            labels={{
              fieldLabel: tt("staffLabel"),
              placeholder: tt("selectStaff"),
              modalTitle: tt("staffModalTitle"),
              close: tt("close"),
            }}
          />
        </div>
      )}
    </div>
  );
}
