"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@/components/ui/icons";
import { fetchCampaignStatusCounts, listCampaigns } from "@/actions/campaigns";
import type {
  CampaignChannel,
  CampaignRow,
  CampaignStatus,
  CampaignStatusCounts,
} from "@/types/campaign";
import { CampaignTable, campaignHref } from "./campaign-table";
import { ChannelFilter } from "./channel-filter";

const PAGE_SIZE = 20;

/** The cards, in the order a campaign moves through them. */
const STATUSES: (CampaignStatus | "all")[] = [
  "all",
  "draft",
  "scheduled",
  "active",
  "paused",
  "sending",
  "sent",
  "cancelled",
  "failed",
];

type ListState = { campaigns: CampaignRow[]; total: number; loading: boolean };
type ListAction =
  | { type: "loading" }
  | { type: "loaded"; campaigns: CampaignRow[]; total: number };

function listReducer(state: ListState, action: ListAction): ListState {
  if (action.type === "loading") return { ...state, loading: true };
  return { campaigns: action.campaigns, total: action.total, loading: false };
}

export default function CampaignsPage() {
  const t = useTranslations("dashboard.campaigns");
  const tCommon = useTranslations("dashboard.common");
  const locale = useDashboardLocale();
  const { push } = useRouter();

  const [{ campaigns, total, loading }, dispatch] = useReducer(listReducer, {
    campaigns: [],
    total: 0,
    loading: true,
  });
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<CampaignStatus | "">("");
  const [channel, setChannel] = useState<CampaignChannel | "">("");
  const [counts, setCounts] = useState<CampaignStatusCounts | null>(null);
  // The totals could not be counted: the cards say so, they never show zeros.
  const [countsFailed, setCountsFailed] = useState(false);
  const [countsAttempt, setCountsAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "loading" });
    void listCampaigns(getAccessToken(), {
      status,
      channel,
      page,
      pageSize: PAGE_SIZE,
    })
      .catch(() => ({ campaigns: [], total: 0 }))
      .then((result) => {
        if (cancelled) return;
        dispatch({
          type: "loaded",
          campaigns: result.campaigns,
          total: result.total,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [page, status, channel]);

  useEffect(() => {
    let cancelled = false;
    void fetchCampaignStatusCounts(getAccessToken(), channel)
      .catch(() => null)
      .then((result) => {
        if (cancelled) return;
        setCountsFailed(result === null);
        if (result) setCounts(result);
      });
    return () => {
      cancelled = true;
    };
  }, [channel, countsAttempt]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button href="/dashboard/campaigns/new" className="gap-2">
          <IconPlus />
          {t("new")}
        </Button>
        <Button
          variant="outline"
          size="md"
          href="/dashboard/campaigns/segments"
        >
          {t("segments.title")}
        </Button>
      </div>

      <div className="mb-4">
        <ChannelFilter
          value={channel}
          onChange={(next) => {
            setChannel(next);
            setPage(0);
          }}
        />
      </div>

      {/* One card per state; the card is the filter. */}
      {/* On a phone the nine cards are one row to swipe (a peek of the next
          one shows there is more, no bar); from `sm` up they are the grid. */}
      <div className="-mx-6 mb-8 flex snap-x snap-mandatory [scrollbar-width:none] gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5 xl:grid-cols-9 [&::-webkit-scrollbar]:hidden">
        {STATUSES.map((value) => {
          const active = (status === "" ? "all" : status) === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setStatus(value === "all" ? "" : value);
                setPage(0);
              }}
              className={`min-w-24 shrink-0 snap-start scroll-mx-6 rounded-2xl border bg-white p-3 text-left transition-colors sm:min-w-0 sm:shrink sm:p-4 ${
                active
                  ? "border-petroleum-400 ring-petroleum-100 ring-2"
                  : "border-sand-200 hover:border-petroleum-400"
              }`}
            >
              <p className="text-petroleum-400 text-xs">
                {value === "all" ? t("filter.all") : t(`status.${value}`)}
              </p>
              {countsFailed ? (
                <p className="font-display text-petroleum-400 mt-1 text-2xl">
                  —
                </p>
              ) : counts === null ? (
                <div className="bg-sand-100 mt-2 h-7 w-10 animate-pulse rounded-lg" />
              ) : (
                <p className="font-display text-petroleum-700 mt-1 text-2xl">
                  {counts[value]}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {countsFailed && (
        <p
          role="alert"
          className="text-petroleum-400 -mt-4 mb-6 text-xs font-medium"
        >
          {t("countsFailed")}{" "}
          <button
            type="button"
            onClick={() => {
              setCounts(null);
              setCountsFailed(false);
              setCountsAttempt((n) => n + 1);
            }}
            className="inline-flex min-h-11 items-center underline underline-offset-2"
          >
            {tCommon("retry")}
          </button>
        </p>
      )}

      <CampaignTable
        campaigns={campaigns}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        onOpen={(campaign) => push(campaignHref(campaign))}
        locale={locale}
        channel={channel}
      />
    </div>
  );
}
