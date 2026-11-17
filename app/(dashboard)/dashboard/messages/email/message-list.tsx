"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { editableLocales } from "@/lib/messages/editor-state";
import { WHATSAPP_MESSAGE_KEYS } from "@/lib/messages/whatsapp-row";
import { MESSAGE_KEYS, type MessageKey } from "@/lib/messages/catalog";
import type {
  MessageCatalogEntry,
  MessageTemplateRowView,
} from "@/lib/messages/types";
import { formatMediumDate } from "@/utils/format";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";
import { ConfirmBar } from "./confirm-bar";
import { WhatsAppRows } from "./whatsapp-rows";

type Locale = "es" | "en";

/** Whether the row carries any text of its own (a switch alone does not). */
function hasText(row: MessageTemplateRowView | undefined): boolean {
  return Boolean(
    row &&
    (row.doc ||
      (row.subject ?? "").trim() ||
      (row.preheader ?? "").trim() ||
      (row.title ?? "").trim()),
  );
}

const PILL =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

/**
 * One row per message and language the system really sends: its name, whether
 * it is the default or the admin's, and what can be done with it. The reminder
 * alone has a switch, because it is the one message nobody is owed.
 */
export function MessageList({
  rows,
  catalog,
  busyKey,
  onEdit,
  onTest,
  onReset,
  onToggle,
  templates,
  onWaConfigure,
  onWaTest,
  onWaRemove,
}: {
  rows: MessageTemplateRowView[];
  catalog: MessageCatalogEntry[];
  /** `key:locale` of the row an action is running on. */
  busyKey: string | null;
  onEdit: (key: MessageKey, locale: Locale) => void;
  onTest: (key: MessageKey, locale: Locale) => void;
  onReset: (key: MessageKey, locale: Locale) => void;
  onToggle: (key: MessageKey, locale: Locale, enabled: boolean) => void;
  /** The account's templates, for the WhatsApp rows; null when unreadable. */
  templates: WhatsAppTemplateRow[] | null;
  onWaConfigure: (key: MessageKey, locale: Locale) => void;
  onWaTest: (key: MessageKey, locale: Locale) => void;
  onWaRemove: (key: MessageKey, locale: Locale) => void;
}) {
  const t = useTranslations("dashboard.messages.email");
  const tKeys = useTranslations("dashboard.messages.keys");
  const tHints = useTranslations("dashboard.messages.keyHints");
  const dashboardLocale = useDashboardLocale();
  const [confirming, setConfirming] = useState<string | null>(null);

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
              const custom = !corrupt && hasText(row);
              const off = Boolean(entry?.canDisable && row && !row.enabled);
              const busy = busyKey === id;
              const switchId = `switch-${key}-${locale}`;
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
                    {entry?.canDisable && !corrupt && (
                      <div className="mt-2 flex items-start gap-3">
                        <button
                          id={switchId}
                          type="button"
                          role="switch"
                          aria-checked={!off}
                          aria-describedby={`${switchId}-hint`}
                          disabled={busy}
                          onClick={() => onToggle(key, locale, off)}
                          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                            off ? "bg-sand-200" : "bg-petroleum-700"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                              off ? "" : "translate-x-5"
                            }`}
                          />
                        </button>
                        <div>
                          <label
                            htmlFor={switchId}
                            className="text-petroleum-700 text-xs font-medium"
                          >
                            {t("reminder.switch")}
                          </label>
                          <p
                            id={`${switchId}-hint`}
                            className="text-petroleum-400 max-w-xs text-xs"
                          >
                            {off ? t("reminder.hintOff") : t("reminder.hintOn")}
                          </p>
                          <Link
                            href="/dashboard/campaigns/new"
                            className="text-petroleum-700 mt-1 inline-block max-w-xs text-xs underline underline-offset-2"
                          >
                            {t("reminder.forWhatsApp")}
                          </Link>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {confirming === id ? (
                      <ConfirmBar
                        message={t("resetConfirm")}
                        yesLabel={t("resetYes")}
                        noLabel={t("resetNo")}
                        returnTo={`reset-${key}-${locale}`}
                        busy={busy}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() => {
                          setConfirming(null);
                          onReset(key, locale);
                        }}
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {!corrupt && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => onEdit(key, locale)}
                            >
                              {t("actions.edit")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => onTest(key, locale)}
                            >
                              {busy ? t("actions.testing") : t("actions.test")}
                            </Button>
                          </>
                        )}
                        {(custom || corrupt || off) && (
                          <Button
                            id={`reset-${key}-${locale}`}
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => setConfirming(id)}
                          >
                            {t("actions.reset")}
                          </Button>
                        )}
                      </div>
                    )}
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
                    busyKey={busyKey}
                    onConfigure={(locale) => onWaConfigure(key, locale)}
                    onTest={(locale) => onWaTest(key, locale)}
                    onRemove={(locale) => onWaRemove(key, locale)}
                  />,
                ]
              : localeRows;
          })}
        </tbody>
      </table>
    </div>
  );
}
