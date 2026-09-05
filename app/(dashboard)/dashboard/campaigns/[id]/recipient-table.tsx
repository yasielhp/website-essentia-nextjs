"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";
import { formatMediumDate, type SupportedLocale } from "@/utils/format";
import type { CampaignRecipientRow } from "@/types/campaign";
import { RecipientStatusBadge } from "../status-badge";

/** The most recent thing that happened to this recipient. */
function lastEvent(row: CampaignRecipientRow): string | null {
  return row.clicked_at ?? row.opened_at ?? row.delivered_at ?? row.sent_at;
}

/**
 * Everyone the campaign went to, with what happened to each. Failures come
 * first (the server orders them so); the search narrows by address.
 */
export function RecipientTable({
  recipients,
  locale,
}: {
  recipients: CampaignRecipientRow[];
  locale: SupportedLocale;
}) {
  const t = useTranslations("dashboard.campaigns.detail");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return recipients;
    return recipients.filter((r) => r.email.includes(term));
  }, [recipients, query]);

  return (
    <section className="border-sand-200 rounded-2xl border bg-white">
      <div className="border-sand-100 flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-petroleum-500 text-sm font-semibold">
          {t("recipients")}
          <span className="text-petroleum-300 ml-1.5 text-xs">
            {recipients.length}
          </span>
        </h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          className={`${INPUT_CLASS} sm:w-64`}
        />
      </div>

      {visible.length === 0 ? (
        <p className="text-petroleum-300 px-6 py-10 text-center text-sm">
          {t("noRecipients")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-sand-100 border-b text-left">
                {(
                  ["email", "language", "status", "date", "error"] as const
                ).map((column) => (
                  <th
                    key={column}
                    className="text-petroleum-400 px-6 py-2.5 text-xs font-medium whitespace-nowrap"
                  >
                    {t(`columns.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className="border-sand-50 border-b last:border-0"
                >
                  <td className="text-petroleum-700 px-6 py-3 font-medium">
                    {row.email}
                  </td>
                  <td className="text-petroleum-500 px-6 py-3 uppercase">
                    {row.language}
                  </td>
                  <td className="px-6 py-3">
                    <RecipientStatusBadge status={row.status} />
                  </td>
                  <td className="text-petroleum-400 px-6 py-3 text-xs whitespace-nowrap">
                    {formatMediumDate(lastEvent(row), locale)}
                  </td>
                  <td className="text-petroleum-400 max-w-xs truncate px-6 py-3 text-xs">
                    {row.error ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
