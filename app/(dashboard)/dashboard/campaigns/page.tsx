"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/calendar/stat-card";
import { IconPlus } from "@/components/ui/icons";
import { fetchCampaignStats, listCampaigns } from "@/actions/campaigns";
import type {
  CampaignRow,
  CampaignStats,
  CampaignStatus,
} from "@/types/campaign";
import { CampaignTable, campaignHref } from "./campaign-table";

const PAGE_SIZE = 20;

const STATUSES: CampaignStatus[] = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "cancelled",
  "failed",
];

const selectCls =
  "border-sand-200 text-petroleum-500 rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-petroleum-300";

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

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
  const [stats, setStats] = useState<CampaignStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "loading" });
    void listCampaigns(getAccessToken(), {
      status,
      page,
      pageSize: PAGE_SIZE,
    }).then((result) => {
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
    void fetchCampaignStats(getAccessToken()).then((result) => {
      if (!cancelled) setStats(result);
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
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as CampaignStatus | "");
            setPage(0);
          }}
          aria-label={t("table.status")}
          className={selectCls}
        >
          <option value="">{t("filter.all")}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`status.${value}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t("stats.sentThisMonth")}
          value={stats?.sentThisMonth ?? 0}
          loading={stats === null}
        />
        <RateCard
          label={t("stats.deliveryRate")}
          value={stats ? percent(stats.delivered, stats.recipients) : 0}
          loading={stats === null}
        />
        <RateCard
          label={t("stats.openRate")}
          value={stats ? percent(stats.opened, stats.delivered) : 0}
          loading={stats === null}
        />
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

/** `StatCard` shows a count; a rate wants the same card with a `%` after it. */
function RateCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <p className="text-petroleum-400 text-sm">{label}</p>
      {loading ? (
        <div className="bg-sand-100 mt-2 h-8 w-16 animate-pulse rounded-lg" />
      ) : (
        <p className="font-display text-petroleum-700 mt-1 text-3xl">
          {value}
          <span className="text-petroleum-400 text-xl">%</span>
        </p>
      )}
    </div>
  );
}
