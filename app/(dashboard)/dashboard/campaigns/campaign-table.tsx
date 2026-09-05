"use client";

import { useTranslations } from "next-intl";
import { formatMediumDate, type SupportedLocale } from "@/utils/format";
import { Pagination } from "@/components/dashboard/pagination";
import type { CampaignRow } from "@/types/campaign";
import { CampaignStatusBadge } from "./status-badge";

/** Where a row leads: a draft opens in the editor, anything sent in its report. */
export function campaignHref(campaign: CampaignRow): string {
  const editable =
    campaign.status === "draft" ||
    campaign.status === "scheduled" ||
    campaign.status === "cancelled";
  return editable
    ? `/dashboard/campaigns/${campaign.id}/edit`
    : `/dashboard/campaigns/${campaign.id}`;
}

/** `delivered / sent`, as a percentage string, or a dash before anything went out. */
export function rate(part: number, whole: number): string {
  if (whole <= 0) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

/** Emails that actually left: the frozen audience minus the ones Resend refused. */
export function sentCount(campaign: CampaignRow): number {
  return Math.max(0, campaign.recipients_count - campaign.failed_count);
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
}: {
  campaigns: CampaignRow[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  onOpen: (campaign: CampaignRow) => void;
  locale: SupportedLocale;
}) {
  const t = useTranslations("dashboard.campaigns");

  return (
    <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
      {loading ? (
        <div className="divide-sand-100 divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-5 py-4"
            >
              <div>
                <div className="bg-sand-100 h-4 w-40 animate-pulse rounded" />
                <div className="bg-sand-100 mt-1.5 h-3 w-24 animate-pulse rounded" />
              </div>
              <div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-petroleum-300 py-20 text-center text-sm">
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
                  <th className={`${TH} text-right`}>{t("table.opened")}</th>
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
                        {campaign.name}
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
                      <td className="text-petroleum-500 px-5 py-3.5 text-right tabular-nums">
                        {rate(campaign.opened_count, sent)}
                      </td>
                      <td className="text-petroleum-500 px-5 py-3.5 text-right tabular-nums">
                        {rate(campaign.clicked_count, sent)}
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
          <div className="divide-sand-100 divide-y md:hidden">
            {campaigns.map((campaign) => {
              const sent = sentCount(campaign);
              return (
                <button
                  key={campaign.id}
                  type="button"
                  onClick={() => onOpen(campaign)}
                  className="hover:bg-sand-50 flex w-full items-center justify-between px-5 py-4 text-left transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-petroleum-700 truncate font-medium">
                      {campaign.name}
                    </p>
                    <p className="text-petroleum-400 text-xs">
                      {formatMediumDate(dateOf(campaign), locale)}
                      {sent > 0 && (
                        <>
                          {" · "}
                          {sent} · {rate(campaign.delivered_count, sent)}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="ml-4 shrink-0">
                    <CampaignStatusBadge status={campaign.status} />
                  </div>
                </button>
              );
            })}
          </div>

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
