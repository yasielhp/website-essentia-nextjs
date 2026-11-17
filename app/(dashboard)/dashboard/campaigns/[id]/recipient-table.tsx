"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";
import { formatMediumDate, type SupportedLocale } from "@/utils/format";
import { describeRecipientError } from "@/lib/campaigns/report";
import type { CampaignChannel, CampaignRecipientRow } from "@/types/campaign";
import { RecipientStatusBadge } from "../status-badge";

/** The most recent thing that happened to this recipient. */
function lastEvent(
  row: CampaignRecipientRow,
  channel: CampaignChannel,
): string | null {
  // WhatsApp has no clicks; the read receipt is its last word.
  return channel === "whatsapp"
    ? (row.read_at ?? row.delivered_at ?? row.sent_at)
    : (row.clicked_at ?? row.opened_at ?? row.delivered_at ?? row.sent_at);
}

/**
 * Everyone the campaign went to, with what happened to each. Failures come
 * first (the server orders them so); the search narrows by address.
 */
export function RecipientTable({
  recipients,
  locale,
  channel = "email",
}: {
  recipients: CampaignRecipientRow[];
  locale: SupportedLocale;
  channel?: CampaignChannel;
}) {
  const t = useTranslations("dashboard.campaigns.detail");
  const tNotes = useTranslations("dashboard.campaigns.detail.notes");
  const whatsapp = channel === "whatsapp";

  /** The error column: our words for what the send marked, Meta's as they came. */
  const errorText = (error: string | null): string => {
    const note = describeRecipientError(error);
    if (!note) return "";
    return note.kind === "raw"
      ? note.text
      : tNotes.has(note.key)
        ? tNotes(note.key, note.values)
        : (error ?? "");
  };
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return recipients;
    // A WhatsApp recipient has a phone and no email; typing "600 11" must
    // still find +34600112233.
    const digits = term.replace(/\s+/g, "");
    return recipients.filter(
      (r) =>
        (r.email ?? "").includes(term) ||
        (digits !== "" && (r.phone ?? "").includes(digits)),
    );
  }, [recipients, query]);

  return (
    <section className="border-sand-200 rounded-2xl border bg-white">
      <div className="border-sand-100 flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-petroleum-500 text-sm font-semibold">
          {t("recipients")}
          <span className="text-petroleum-400 ml-1.5 text-xs">
            {recipients.length}
          </span>
        </h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={whatsapp ? t("searchPhone") : t("search")}
          aria-label={whatsapp ? t("searchPhone") : t("search")}
          className={`${INPUT_CLASS} sm:w-64`}
        />
      </div>

      {visible.length === 0 ? (
        <p className="text-petroleum-400 px-6 py-10 text-center text-sm">
          {t("noRecipients")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-sand-100 border-b text-left">
                {(
                  [
                    whatsapp ? "phone" : "email",
                    "language",
                    "status",
                    "date",
                    "error",
                  ] as const
                ).map((column) => (
                  <th
                    key={column}
                    className="text-petroleum-400 px-6 py-2.5 text-xs font-medium whitespace-nowrap"
                  >
                    {column === "phone"
                      ? t("columnsPhone")
                      : t(`columns.${column}`)}
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
                    {whatsapp ? (row.phone ?? "—") : (row.email ?? row.phone)}
                  </td>
                  <td className="text-petroleum-500 px-6 py-3 uppercase">
                    {row.language}
                  </td>
                  <td className="px-6 py-3">
                    <RecipientStatusBadge
                      status={row.status}
                      channel={channel}
                    />
                  </td>
                  <td className="text-petroleum-400 px-6 py-3 text-xs whitespace-nowrap">
                    {formatMediumDate(lastEvent(row, channel), locale)}
                  </td>
                  <td
                    className="text-petroleum-400 max-w-xs truncate px-6 py-3 text-xs"
                    title={errorText(row.error)}
                  >
                    {errorText(row.error)}
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
