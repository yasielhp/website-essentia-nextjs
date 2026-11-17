"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { editableLocales } from "@/lib/messages/editor-state";
import { messageEditHref } from "@/lib/messages/message-route";
import { isSwitchedOff, rowHasText } from "@/lib/messages/reminder-switch";
import { WHATSAPP_MESSAGE_KEYS } from "@/lib/messages/whatsapp-row";
import { MESSAGE_KEYS } from "@/lib/messages/catalog";
import type {
  MessageCatalogEntry,
  MessageTemplateRowView,
} from "@/lib/messages/types";
import { formatMediumDate } from "@/utils/format";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";
import { WhatsAppRows } from "./whatsapp-rows";

const PILL =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

/**
 * One row per message and language the system really sends: its name, whether
 * it is the default or the admin's (and, for the reminder, whether it is
 * switched off), and one link to the page where it is edited. Testing, the
 * reminder's switch and resetting are on that page.
 */
export function MessageList({
  rows,
  catalog,
  templates,
}: {
  rows: MessageTemplateRowView[];
  catalog: MessageCatalogEntry[];
  /** The account's templates, for the WhatsApp rows; null when unreadable. */
  templates: WhatsAppTemplateRow[] | null;
}) {
  const t = useTranslations("dashboard.messages.email");
  const tKeys = useTranslations("dashboard.messages.keys");
  const tHints = useTranslations("dashboard.messages.keyHints");
  const dashboardLocale = useDashboardLocale();

  const emailRows = rows.filter((row) => row.channel === "email");

  return (
    <div className="border-sand-200 overflow-x-auto rounded-2xl border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-sand-100 border-b text-left">
            {(["message", "language", "status", "actions"] as const).map(
              (column) => (
                <th
                  key={column}
                  scope="col"
                  className="text-petroleum-400 px-5 py-3 text-xs font-medium whitespace-nowrap"
                >
                  {t(`columns.${column}`)}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {MESSAGE_KEYS.flatMap((key) => {
            const entry = catalog.find((c) => c.key === key);
            const localeRows = editableLocales(key).map((locale) => {
              const id = `${key}:${locale}`;
              const row = emailRows.find(
                (r) => r.key === key && r.locale === locale,
              );
              const corrupt = row?.corrupt === true;
              const custom = !corrupt && rowHasText(row);
              const off = isSwitchedOff(Boolean(entry?.canDisable), row);
              return (
                <tr
                  key={id}
                  className="border-sand-100 border-b align-top last:border-0"
                >
                  <th scope="row" className="px-5 py-3.5 text-left font-normal">
                    <p className="text-petroleum-700 font-medium">
                      {tKeys(key)}
                    </p>
                    <p className="text-petroleum-400 mt-0.5 max-w-xs text-xs">
                      {tHints(key)}
                    </p>
                    {key === "booking_reminder" && (
                      <p className="text-petroleum-400 mt-1 max-w-xs text-xs">
                        {t("reminder.note")}
                      </p>
                    )}
                  </th>
                  <td className="text-petroleum-500 px-5 py-3.5">
                    {t(`locales.${locale}`)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`${PILL} ${
                          corrupt
                            ? "bg-red-100 text-red-700"
                            : custom
                              ? "bg-green-100 text-green-800"
                              : "bg-sand-100 text-petroleum-500"
                        }`}
                      >
                        {t(
                          corrupt
                            ? "status.corrupt"
                            : custom
                              ? "status.custom"
                              : "status.default",
                        )}
                      </span>
                      {off && (
                        <span
                          className={`${PILL} bg-yellow-100 text-yellow-800`}
                        >
                          {t("status.disabled")}
                        </span>
                      )}
                    </div>
                    {custom && row?.updated_at && (
                      <p className="text-petroleum-400 mt-1 text-xs">
                        {row.updated_by_name
                          ? t("savedOnBy", {
                              date: formatMediumDate(
                                row.updated_at,
                                dashboardLocale,
                              ),
                              name: row.updated_by_name,
                            })
                          : t("savedOn", {
                              date: formatMediumDate(
                                row.updated_at,
                                dashboardLocale,
                              ),
                            })}
                      </p>
                    )}
                    {corrupt && (
                      <p
                        role="alert"
                        className="mt-1 max-w-xs text-xs text-red-700"
                      >
                        {t("corrupt")}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {/* A page of its own: a link, so it opens in a new tab too. */}
                    <Button
                      size="sm"
                      variant="outline"
                      href={messageEditHref("email", key, locale)}
                      aria-label={t("actions.editRow", {
                        name: tKeys(key),
                        language: t(`locales.${locale}`),
                      })}
                    >
                      {t("actions.edit")}
                    </Button>
                  </td>
                </tr>
              );
            });
            return WHATSAPP_MESSAGE_KEYS.includes(key)
              ? [
                  ...localeRows,
                  <WhatsAppRows
                    key={`wa-${key}`}
                    messageKey={key}
                    rows={rows}
                    templates={templates}
                  />,
                ]
              : localeRows;
          })}
        </tbody>
      </table>
    </div>
  );
}
