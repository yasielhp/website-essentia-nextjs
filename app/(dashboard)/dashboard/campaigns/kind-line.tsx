"use client";

import { useTranslations } from "next-intl";
import { appointmentShort } from "@/lib/campaigns/appointment-form";
import type { CampaignKind, CampaignTrigger } from "@/types/campaign";

/**
 * "48 h before the appointment" for an appointment notice, or null for any
 * other trigger (those have their own wording where they are shown).
 */
export function useAppointmentTrigger(): (
  trigger: CampaignTrigger,
) => string | null {
  const t = useTranslations("dashboard.campaigns.trigger.appointment");
  return (trigger) => {
    const short = appointmentShort(trigger);
    return short ? t(short.key, { hours: short.hours }) : null;
  };
}

/**
 * The line under a campaign's name in the list that says what an appointment
 * notice is and when it goes out; the other kinds say nothing here, as ever.
 */
export function CampaignKindLine({
  kind,
  trigger,
}: {
  kind: CampaignKind;
  trigger: CampaignTrigger;
}) {
  const tType = useTranslations("dashboard.campaigns.type");
  const when = useAppointmentTrigger()(trigger);
  if (kind !== "appointment") return null;
  return (
    <span className="text-petroleum-400 block text-xs font-normal">
      {[tType("appointment"), when].filter(Boolean).join(" · ")}
    </span>
  );
}
