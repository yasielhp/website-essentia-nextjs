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
  CampaignRow,
  CampaignStatus,
  CampaignStatusCounts,
} from "@/types/campaign";
import { CampaignTable, campaignHref } from "./campaign-table";

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
  const locale = useDashboardLocale();
  const { push } = useRouter();

  const [{ campaigns, total, loading }, dispatch] = useReducer(listReducer, {
    campaigns: [],
    total: 0,
    loading: true,
  });
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<CampaignStatus | "">("");
  const [counts, setCounts] = useState<CampaignStatusCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "loading" });
    void listCampaigns(getAccessToken(), {
      status,
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
  }, [page, status]);

  useEffect(() => {
    let cancelled = false;
    void fetchCampaignStatusCounts(getAccessToken())
      .catch(() => null)
      .then((result) => {
        if (!cancelled && result) setCounts(result);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

      {/* One card per state; the card is the filter. */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
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
              className={`rounded-2xl border bg-white p-4 text-left transition-colors ${
                active
                  ? "border-petroleum-400 ring-petroleum-100 ring-2"
                  : "border-sand-200 hover:border-petroleum-400"
              }`}
            >
              <p className="text-petroleum-400 text-xs">
                {value === "all" ? t("filter.all") : t(`status.${value}`)}
              </p>
              {counts === null ? (
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

      <CampaignTable
        campaigns={campaigns}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        onOpen={(campaign) => push(campaignHref(campaign))}
        locale={locale}
      />
    </div>
  );
}
