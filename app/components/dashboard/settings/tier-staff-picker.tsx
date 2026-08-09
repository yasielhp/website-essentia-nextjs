"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { MultiOptionSelect } from "@/components/ui/multi-option-select";
import type { SelectOption } from "@/components/ui/option-select";

/**
 * Who performs this session type.
 *
 * The assignment drives availability, not just paperwork: a slot is offered
 * when at least one assigned therapist has it free on their own calendar. A
 * session type with nobody assigned cannot be booked at all, which the empty
 * state says out loud rather than leaving to be discovered.
 */
export function TierStaffPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations("dashboard.settings.staff");
  const [staff, setStaff] = useState<SelectOption<string>[] | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("profiles")
        .select("id, full_name, first_name, last_name, google_connected_email")
        // Admins run the dashboard; the people who perform treatments are staff.
        .eq("role", "staff")
        .order("full_name");

      setStaff(
        (
          (data ?? []) as {
            id: string;
            full_name: string | null;
            first_name: string | null;
            last_name: string | null;
            google_connected_email: string | null;
          }[]
        ).map((row) => ({
          value: row.id,
          label:
            row.full_name ??
            [row.first_name, row.last_name].filter(Boolean).join(" ") ??
            "—",
          // Without a calendar there is nothing to check, so every slot of
          // theirs counts as free. Worth seeing while assigning.
          desc: row.google_connected_email ? undefined : t("noCalendar"),
        })),
      );
    }
    void load();
  }, [t]);

  if (staff === null) {
    return <div className="bg-sand-100 h-12 animate-pulse rounded-xl" />;
  }

  if (staff.length === 0) {
    return <p className="text-petroleum-300 text-sm">{t("noStaff")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <MultiOptionSelect
        value={selected}
        options={staff}
        onChange={onChange}
        ariaLabel={t("ariaLabel")}
        placeholder={t("placeholder")}
      />

      {/* The array keeps the order they were ticked in, and that is the order
          the booking form offers them in — the trigger shows it back. */}
      {selected.length === 0 && (
        <p className="text-xs text-red-600">{t("noneWarning")}</p>
      )}
    </div>
  );
}
