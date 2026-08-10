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
    priceOnline: t.price_eur ?? t.price_center_eur,
    imageUrl: t.image_url,
    color: t.color,
  };
}

export type TierSelection = {
  tierId: string;
  label: string | null;
  duration: string | null;
  /** What it costs at the centre. */
  price: number | null;
  /** What it costs paying online, which may be lower. */
  priceOnline: number | null;
};

export function DurationStep({
  serviceId,
  selectedTierId,
  staffId,
  onSelect,
  onSelectStaff,
  onStaffLoaded,
  preselectedLabel,
}: {
  serviceId: string;
  selectedTierId: string | null;
  staffId: string | null;
  onSelect: (sel: TierSelection) => void;
  onSelectStaff: (person: TierStaff) => void;
  /** Tells the form whether this session type can be performed at all. */
  onStaffLoaded: (hasStaff: boolean) => void;
  preselectedLabel?: string | null;
}) {
  const tt = useTranslations("booking.durationStep");
  const [tiers, setTiers] = useState<Tier[] | null>(null);
  const [staff, setStaff] = useState<TierStaff[]>([]);

  // Held in a ref so the parent may pass an inline callback without
  // re-running the fetch on every render.
  const onStaffLoadedRef = useRef(onStaffLoaded);
  useEffect(() => {
    onStaffLoadedRef.current = onStaffLoaded;
  });

  // Who can perform the chosen session type. Assignments live in the
  // dashboard, so the list changes with the tier, not with the service.
  useEffect(() => {
    let cancelled = false;
    void (
      selectedTierId
        ? fetchTierStaff(selectedTierId)
        : Promise.resolve([] as TierStaff[])
    ).then((people) => {
      if (cancelled) return;
      setStaff(people);
      onStaffLoadedRef.current(people.length > 0);
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
    let cancelled = false;

    async function load() {
      const { data } = await insforge.database
        .from("service_tiers")
        .select(
          "id, label, duration_minutes, price_eur, price_center_eur, image_url, color",
        )
        .eq("service_id", serviceId)
        .eq("active", true)
        .order("sort_order");

      if (cancelled) return;

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
          priceOnline: t.price_eur ?? t.price_center_eur,
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
            priceOnline: match.price_eur ?? match.price_center_eur,
          });
        }
      }
    }
    void load();

    return () => {
      cancelled = true;
    };
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
              priceOnline: o.priceOnline ?? o.price,
            })
          }
        />
      )}
      {/* Only once a session type is chosen — the question is about that
          session, and only the people assigned to it can be picked. */}
      {/* Nobody assigned means nobody can perform it, so the booking cannot
          go further. Said here rather than at the empty calendar three steps
          later. */}
      {selectedTierId !== null && staff.length === 0 && (
        <div className="border-sand-300 bg-sand-50 flex flex-col gap-2 rounded-2xl border px-4 py-4">
          <p className="text-petroleum-700 text-sm font-medium">
            {tt("noStaffTitle")}
          </p>
          <p className="text-petroleum-400 text-sm">{tt("noStaffBody")}</p>
        </div>
      )}

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
