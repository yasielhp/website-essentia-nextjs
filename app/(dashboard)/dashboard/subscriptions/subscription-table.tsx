"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatMediumDate, type SupportedLocale } from "@/utils/format";
import { Pagination } from "@/components/dashboard/pagination";
import type { Subscription } from "./types";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  expired: "bg-sand-100 text-petroleum-400",
  cancelled: "bg-red-50 text-red-500",
};

const PLAN_STYLES: Record<string, string> = {
  essential: "bg-sand-100 text-petroleum-500",
  premium: "bg-blue-50 text-blue-700",
  founder: "bg-purple-50 text-purple-700",
};

/**
 * The list of memberships, in the two shapes it needs: cards on a phone, a
 * table on a desk. Both were inside the page that queries them, along with
 * their loading skeletons, which was most of the file.
 */
export function SubscriptionTable({
  subscriptions,
  loading,
  page,
  totalPages,
  onPage,
  onOpen,
  locale,
  planLabel,
  statusLabel,
}: {
  subscriptions: Subscription[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  onOpen: (id: string) => void;
  locale: SupportedLocale;
  planLabel: (plan: string) => string;
  statusLabel: (status: string) => string;
}) {
  const t = useTranslations("dashboard");

  return (
    <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
      {loading ? (
        <>
          {/* Mobile skeleton */}
          <div className="divide-sand-100 divide-y md:hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-4"
              >
                <div>
                  <div className="bg-sand-100 h-4 w-32 animate-pulse rounded" />
                  <div className="bg-sand-100 mt-1.5 h-3 w-44 animate-pulse rounded" />
                </div>
                <div className="ml-4 flex flex-col items-end gap-1.5">
                  <div className="bg-sand-100 h-5 w-16 animate-pulse rounded-full" />
                  <div className="bg-sand-100 h-5 w-14 animate-pulse rounded-full" />
                </div>
              </div>
            ))}
          </div>
          {/* Desktop skeleton */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-sand-100 border-b">
                    <td className="px-5 py-3.5">
                      <div className="bg-sand-100 h-4 w-32 animate-pulse rounded" />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="bg-sand-100 h-4 w-40 animate-pulse rounded" />
                      <div className="bg-sand-100 mt-1.5 h-3 w-24 animate-pulse rounded" />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="bg-sand-100 h-5 w-16 animate-pulse rounded-full" />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="bg-sand-100 h-4 w-20 animate-pulse rounded" />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="bg-sand-100 h-4 w-20 animate-pulse rounded" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : subscriptions.length === 0 ? (
        <div className="text-petroleum-300 py-20 text-center text-sm">
          {t("subscriptions.empty")}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-sand-100 border-b">
                  <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                    {t("subscriptions.columns.name")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                    {t("subscriptions.columns.contact")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                    {t("subscriptions.columns.plan")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                    {t("subscriptions.columns.status")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                    {t("subscriptions.columns.start")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                    {t("subscriptions.columns.expires")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => onOpen(m.id)}
                    className="border-sand-100 hover:bg-sand-50 cursor-pointer border-b transition-colors last:border-0"
                  >
                    <td className="text-petroleum-700 px-5 py-3.5 font-medium">
                      <Link
                        href={`/dashboard/subscriptions/${m.id}`}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        className="rounded outline-offset-2"
                      >
                        {m.first_name} {m.last_name}
                      </Link>
                    </td>
                    <td className="text-petroleum-500 px-5 py-3.5">
                      <div>{m.email ?? t("common.empty")}</div>
                      {m.phone && (
                        <div className="text-petroleum-400 text-xs">
                          {m.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${PLAN_STYLES[m.plan] ?? "bg-sand-100 text-petroleum-500"}`}
                      >
                        {planLabel(m.plan)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[m.status] ?? "bg-sand-100 text-petroleum-400"}`}
                      >
                        {statusLabel(m.status)}
                      </span>
                    </td>
                    <td className="text-petroleum-500 px-5 py-3.5 text-xs">
                      {formatMediumDate(m.start_date, locale)}
                    </td>
                    <td className="text-petroleum-500 px-5 py-3.5 text-xs">
                      {formatMediumDate(m.end_date, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-sand-100 divide-y md:hidden">
            {subscriptions.map((m) => (
              <button
                key={m.id}
                onClick={() => onOpen(m.id)}
                className="hover:bg-sand-50 flex w-full items-center justify-between px-5 py-4 text-left transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-petroleum-700 truncate font-medium">
                    {m.first_name} {m.last_name}
                  </p>
                  <p className="text-petroleum-400 truncate text-xs">
                    {m.email ?? m.phone ?? t("common.empty")}
                  </p>
                </div>
                <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[m.status] ?? "bg-sand-100 text-petroleum-400"}`}
                  >
                    {statusLabel(m.status)}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${PLAN_STYLES[m.plan] ?? "bg-sand-100 text-petroleum-500"}`}
                  >
                    {planLabel(m.plan)}
                  </span>
                </div>
              </button>
            ))}
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
