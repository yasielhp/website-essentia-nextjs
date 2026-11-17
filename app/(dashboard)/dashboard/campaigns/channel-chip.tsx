"use client";

import { useTranslations } from "next-intl";
import { IconChat, IconMail } from "@/components/ui/icons";
import type { CampaignChannel } from "@/types/campaign";

/**
 * Where a campaign goes out. The word is always there next to the icon: the
 * icon alone says nothing to a screen reader, and little to anyone else.
 */
export function ChannelChip({ channel }: { channel: CampaignChannel }) {
  const t = useTranslations("dashboard.campaigns.channel");
  return (
    <span className="bg-sand-100 text-petroleum-500 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5">
      {channel === "whatsapp" ? <IconChat /> : <IconMail />}
      {t(channel === "whatsapp" ? "whatsapp" : "email")}
    </span>
  );
}
