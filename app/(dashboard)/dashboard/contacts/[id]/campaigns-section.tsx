"use client";

import { useTranslations } from "next-intl";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { formatMediumDate } from "@/utils/format";
import { Button } from "@/components/ui/button";
import type { ContactCampaignRow } from "@/types/campaign";
import { RecipientStatusBadge } from "../../campaigns/status-badge";

/** The campaigns this contact was sent, and what became of each. */
export function CampaignsSection({
  loading,
  campaigns,
}: {
  loading: boolean;
  campaigns: ContactCampaignRow[];
}) {
  const t = useTranslations("dashboard.contacts.detail.campaigns");
  const tCampaigns = useTranslations("dashboard.campaigns.table");
  const locale = useDashboardLocale();

  if (loading) {
    return <div className="bg-sand-100 h-16 animate-pulse rounded-xl" />;
  }
  if (campaigns.length === 0) {
    return <p className="text-petroleum-400 text-sm">{t("empty")}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-sand-100 border-b text-left">
            {(["name", "date", "status"] as const).map((column) => (
              <th
                key={column}
                className="text-petroleum-400 pr-4 pb-2.5 font-medium"
              >
                {tCampaigns(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campaigns.map((row) => (
            <tr key={row.id} className="border-sand-50 border-b last:border-0">
              <td className="text-petroleum-700 py-3 pr-4 font-medium">
                {row.campaign?.name ?? "—"}
              </td>
              <td className="text-petroleum-500 py-3 pr-4">
                {formatMediumDate(row.sent_at ?? row.campaign?.sent_at, locale)}
              </td>
              <td className="py-3">
                <RecipientStatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The red line above the form when the address has bounced. Cleared by hand,
 * after somebody has talked to the client: nothing else lifts the exclusion.
 */
export function BounceBanner({
  bouncedAt,
  clearing,
  onClear,
}: {
  bouncedAt: string;
  clearing: boolean;
  onClear: () => void;
}) {
  const t = useTranslations("dashboard.contacts.detail.campaigns");
  const locale = useDashboardLocale();
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-red-700">
        {t("bounced", { date: formatMediumDate(bouncedAt, locale) })}
      </p>
      <Button variant="outline" size="md" disabled={clearing} onClick={onClear}>
        {t("clearBounce")}
      </Button>
    </div>
  );
}
