"use client";

import { useTranslations } from "next-intl";
import type { CampaignStatus, RecipientStatus } from "@/types/campaign";

/**
 * One pill for both vocabularies: a campaign's state and a recipient's. The
 * colours say the same thing in both — green is done, amber is pending, red
 * needs somebody to look.
 */

const CAMPAIGN_STYLES: Record<CampaignStatus, string> = {
  draft: "bg-sand-100 text-petroleum-500",
  scheduled: "bg-amber-100 text-amber-800",
  sending: "bg-blue-100 text-blue-800",
  sent: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-sand-200 text-petroleum-400",
  failed: "bg-red-100 text-red-700",
};

const RECIPIENT_STYLES: Record<RecipientStatus, string> = {
  queued: "bg-sand-100 text-petroleum-500",
  sent: "bg-sand-100 text-petroleum-500",
  delivered: "bg-emerald-100 text-emerald-800",
  opened: "bg-emerald-100 text-emerald-800",
  clicked: "bg-emerald-200 text-emerald-900",
  bounced: "bg-red-100 text-red-700",
  complained: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
};

const PILL =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const t = useTranslations("dashboard.campaigns.status");
  return (
    <span
      className={`${PILL} ${CAMPAIGN_STYLES[status] ?? CAMPAIGN_STYLES.draft}`}
    >
      {t.has(status) ? t(status) : status}
    </span>
  );
}

export function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  const t = useTranslations("dashboard.campaigns.recipientStatus");
  return (
    <span
      className={`${PILL} ${RECIPIENT_STYLES[status] ?? RECIPIENT_STYLES.queued}`}
    >
      {t.has(status) ? t(status) : status}
    </span>
  );
}
