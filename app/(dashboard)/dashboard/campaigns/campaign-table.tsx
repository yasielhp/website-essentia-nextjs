"use client";

import { useTranslations } from "next-intl";
import { formatMediumDate, type SupportedLocale } from "@/utils/format";
import { MobileRowCard } from "@/components/dashboard/mobile-row-card";
import { Pagination } from "@/components/dashboard/pagination";
import { TableSkeleton } from "@/components/dashboard/skeletons";
import type { CampaignChannel, CampaignRow } from "@/types/campaign";
import { campaignSentCount } from "@/lib/campaigns/report";
import { ChannelChip } from "./channel-chip";
import { CampaignKindLine } from "./kind-line";
import { CampaignStatusBadge } from "./status-badge";

/** Where a row leads: a draft opens in the editor, anything sent in its report. */
export function campaignHref(campaign: CampaignRow): string {
  const editable =
    campaign.status === "draft" ||
    campaign.status === "scheduled" ||
    campaign.status === "cancelled" ||
    campaign.status === "failed" ||
    campaign.status === "paused";
  return editable
    ? `/dashboard/campaigns/${campaign.id}/edit`
    : `/dashboard/campaigns/${campaign.id}`;
}

/** `delivered / sent`, as a percentage string, or a dash before anything went out. */
export function rate(part: number, whole: number): string {
  if (whole <= 0) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

/** Messages that actually left; see `campaignSentCount` for the one case that differs. */
export function sentCount(campaign: CampaignRow): number {
  return campaignSentCount(campaign);
}

function dateOf(campaign: CampaignRow): string | null {
  return campaign.sent_at ?? campaign.scheduled_at ?? campaign.updated_at;
}

const TH =
  "text-petroleum-400 px-5 py-3 text-left text-xs font-medium whitespace-nowrap";

export function CampaignTable({
  campaigns,
  loading,
  page,
  totalPages,
  onPage,
  onOpen,
  locale,
  channel = "",
}: {
  campaigns: CampaignRow[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  onOpen: (campaign: CampaignRow) => void;
  locale: SupportedLocale;
  /** The channel the list is narrowed to; both when empty. */
  channel?: CampaignChannel | "";
}) {
  const t = useTranslations("dashboard.campaigns");

  return (
    <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
      {loading ? (
        <TableSkeleton cols={7} />
      ) : campaigns.length === 0 ? (
        <div className="text-petroleum-400 py-20 text-center text-sm">
          {t("empty")}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-sand-100 border-b">
                  <th className={TH}>{t("table.name")}</th>
                  <th className={TH}>{t("table.status")}</th>
                  <th className={`${TH} text-right`}>
                    {t("table.recipients")}
                  </th>
                  <th className={`${TH} text-right`}>{t("table.delivered")}</th>
                  <th className={`${TH} text-right`}>
                    {channel === "whatsapp"
                      ? t("detail.read")
                      : channel === "email"
                        ? t("table.opened")
                        : t("table.openedOrRead")}
                  </th>
                  <th className={`${TH} text-right`}>{t("table.clicked")}</th>
                  <th className={TH}>{t("table.date")}</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const sent = sentCount(campaign);
                  return (
                    <tr
                      key={campaign.id}
                      onClick={() => onOpen(campaign)}
                      className="border-sand-100 hover:bg-sand-50 cursor-pointer border-b transition-colors last:border-0"
                    >
                      <td className="text-petroleum-700 px-5 py-3.5 font-medium">
                        <span className="flex flex-wrap items-center gap-2">
                          {campaign.name}
                          <ChannelChip channel={campaign.channel} />
                        </span>
                        <CampaignKindLine
                          kind={campaign.kind}
                          trigger={campaign.trigger}
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <CampaignStatusBadge status={campaign.status} />
                      </td>
                      <td className="text-petroleum-500 px-5 py-3.5 text-right tabular-nums">
                        {campaign.recipients_count > 0
                          ? campaign.recipients_count
                          : "—"}
                      </td>
                      <td className="text-petroleum-500 px-5 py-3.5 text-right tabular-nums">
                        {rate(campaign.delivered_count, sent)}
                      </td>
                      <td
                        className="text-petroleum-500 px-5 py-3.5 text-right tabular-nums"
                        title={
                          campaign.channel === "whatsapp"
                            ? t("detail.read")
                            : undefined
                        }
                      >
                        {rate(campaign.opened_count, sent)}
                      </td>
                      <td className="text-petroleum-500 px-5 py-3.5 text-right tabular-nums">
                        {/* Meta reports no clicks, so there is nothing to show. */}
                        {campaign.channel === "whatsapp"
                          ? "—"
                          : rate(campaign.clicked_count, sent)}
                      </td>
                      <td className="text-petroleum-500 px-5 py-3.5 text-xs whitespace-nowrap">
                        {formatMediumDate(dateOf(campaign), locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="divide-sand-100 divide-y md:hidden">
            {campaigns.map((campaign) => {
              const sent = sentCount(campaign);
              return (
                <MobileRowCard
                  key={campaign.id}
                  title={
                    // The card opens the campaign: the name is the button, as
                    // tall as a thumb needs, and it wraps instead of cutting.
                    <button
                      type="button"
                      onClick={() => onOpen(campaign)}
                      className="focus-visible:ring-petroleum-500 min-h-11 w-full rounded text-left break-words focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {campaign.name}
                    </button>
                  }
                  description={
                    <CampaignKindLine
                      kind={campaign.kind}
                      trigger={campaign.trigger}
                    />
                  }
                  facts={[
                    {
                      label: t("table.status"),
                      value: <CampaignStatusBadge status={campaign.status} />,
                    },
                    {
                      label: t("table.date"),
                      value: formatMediumDate(dateOf(campaign), locale),
                    },
                    {
                      label: t("table.recipients"),
                      value:
                        campaign.recipients_count > 0
                          ? campaign.recipients_count
                          : "—",
                    },
                    {
                      label: t("table.delivered"),
                      value: rate(campaign.delivered_count, sent),
                    },
                  ]}
                >
                  <div>
                    <ChannelChip channel={campaign.channel} />
                  </div>
                </MobileRowCard>
              );
            })}
          </ul>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={onPage}
            loading={loading}
          />
        </>
      )}
    </div>
  );
}
