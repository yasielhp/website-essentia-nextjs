"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  MOBILE_ACTION,
  MobileRowCard,
} from "@/components/dashboard/mobile-row-card";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { messageEditHref } from "@/lib/messages/message-route";
import {
  messageListRows,
  type EmailListRow,
  type WhatsAppListRow,
} from "@/lib/messages/list-rows";
import type {
  MessageCatalogEntry,
  MessageTemplateRowView,
} from "@/lib/messages/types";
import { formatMediumDate } from "@/utils/format";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";

const PILL =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

/**
 * The words of a row, shared by the table and the cards: the name of the
 * message, its state and the link's name are written once.
 */
function useRowWords() {
  const t = useTranslations("dashboard.messages.email");
  const tWa = useTranslations("dashboard.messages.email.whatsapp");
  const tKeys = useTranslations("dashboard.messages.keys");
  const tHints = useTranslations("dashboard.messages.keyHints");
  const locale = useDashboardLocale();
  const language = (l: "es" | "en") => t(`locales.${l}`);

  return {
    t,
    tWa,
    column: (name: "language" | "status") => t(`columns.${name}`),
    language,
    emailName: (row: EmailListRow) => tKeys(row.key),
    emailHint: (row: EmailListRow) => tHints(row.key),
    whatsappName: (row: WhatsAppListRow) => (
      <>
        {tKeys(row.key)}{" "}
        <span className="text-petroleum-400 font-normal">
          · {tWa("channelLabel")}
        </span>
      </>
    ),
    emailLink: (row: EmailListRow) => ({
      href: messageEditHref("email", row.key, row.locale),
      label: t("actions.edit"),
      name: t("actions.editRow", {
        name: tKeys(row.key),
        language: language(row.locale),
      }),
    }),
    whatsappLink: (row: WhatsAppListRow) => ({
      href: messageEditHref("whatsapp", row.key, row.locale),
      label: row.saved ? tWa("actions.edit") : tWa("actions.configure"),
      name: tWa(row.saved ? "actions.editRow" : "actions.configureRow", {
        name: tKeys(row.key),
        language: language(row.locale),
      }),
    }),
    savedOn: (row: EmailListRow) =>
      row.custom && row.updatedAt
        ? row.updatedByName
          ? t("savedOnBy", {
              date: formatMediumDate(row.updatedAt, locale),
              name: row.updatedByName,
            })
          : t("savedOn", { date: formatMediumDate(row.updatedAt, locale) })
        : null,
  };
}

/** The state of an email row: default, custom or unreadable, and "off". */
function EmailStatus({ row }: { row: EmailListRow }) {
  const t = useTranslations("dashboard.messages.email");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`${PILL} whitespace-nowrap ${
          row.corrupt
            ? "bg-red-100 text-red-700"
            : row.custom
              ? "bg-green-100 text-green-800"
              : "bg-sand-100 text-petroleum-500"
        }`}
      >
        {t(
          row.corrupt
            ? "status.corrupt"
            : row.custom
              ? "status.custom"
              : "status.default",
        )}
      </span>
      {row.off && (
        <span
          className={`${PILL} bg-yellow-100 whitespace-nowrap text-yellow-800`}
        >
          {t("status.disabled")}
        </span>
      )}
    </div>
  );
}

/** What a WhatsApp row does today. It can be long, so it wraps. */
function WhatsAppStatus({ row }: { row: WhatsAppListRow }) {
  const tWa = useTranslations("dashboard.messages.email.whatsapp");
  const { state } = row;
  const tone =
    state.kind === "configured"
      ? "bg-green-100 text-green-800"
      : state.kind === "invalid"
        ? "bg-red-100 text-red-700"
        : state.kind === "off" || state.kind === "unknown"
          ? "bg-yellow-100 text-yellow-800"
          : "bg-sand-100 text-petroleum-500";
  return (
    <span className={`${PILL} ${tone} max-w-full text-left`}>
      {state.kind === "configured"
        ? tWa("state.configured", { name: state.templateName })
        : state.kind === "invalid"
          ? tWa("state.invalid", { reason: tWa(`issue.${state.issue}`) })
          : tWa(`state.${state.kind}`)}
    </span>
  );
}

/** What is said under an email's state: when it was saved, or that it is unreadable. */
function EmailNotes({
  row,
  savedOn,
}: {
  row: EmailListRow;
  savedOn: string | null;
}) {
  const t = useTranslations("dashboard.messages.email");
  return (
    <>
      {savedOn && <p className="text-petroleum-400 mt-1 text-xs">{savedOn}</p>}
      {row.corrupt && (
        <p role="alert" className="mt-1 max-w-xs text-xs text-red-700">
          {t("corrupt")}
        </p>
      )}
    </>
  );
}

/**
 * One row per message and language the system really sends: its name, whether
 * it is the default or the admin's (and, for the reminder, whether it is
 * switched off), and one link to the page where it is edited. Testing, the
 * reminder's switch and resetting are on that page.
 *
 * A table on a wide screen and a list of cards on a phone, as the other lists
 * of the dashboard do. Both are drawn from `messageListRows`, so which rows
 * there are and what each says is decided once; only the layout differs.
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
  const w = useRowWords();
  const list = messageListRows(rows, catalog, templates);

  return (
    <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
      {/* Desktop table */}
      <div className="hidden md:block">
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
                    {w.t(`columns.${column}`)}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {list.map((row) => {
              if (row.type === "whatsapp") {
                const link = w.whatsappLink(row);
                return (
                  <tr
                    key={row.id}
                    className="border-sand-100 bg-sand-50/50 border-b align-top last:border-0"
                  >
                    <th scope="row" className="px-5 py-3 text-left font-normal">
                      <p className="text-petroleum-700 text-sm font-medium">
                        {w.whatsappName(row)}
                      </p>
                    </th>
                    <td className="text-petroleum-500 px-5 py-3">
                      {w.language(row.locale)}
                    </td>
                    <td className="px-5 py-3">
                      <WhatsAppStatus row={row} />
                    </td>
                    <td className="px-5 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        href={link.href}
                        aria-label={link.name}
                      >
                        {link.label}
                      </Button>
                    </td>
                  </tr>
                );
              }
              const link = w.emailLink(row);
              return (
                <tr
                  key={row.id}
                  className="border-sand-100 border-b align-top last:border-0"
                >
                  <th scope="row" className="px-5 py-3.5 text-left font-normal">
                    <p className="text-petroleum-700 font-medium">
                      {w.emailName(row)}
                    </p>
                    <p className="text-petroleum-400 mt-0.5 max-w-xs text-xs">
                      {w.emailHint(row)}
                    </p>
                    {row.reminderNote && (
                      <p className="text-petroleum-400 mt-1 max-w-xs text-xs">
                        {w.t("reminder.note")}
                      </p>
                    )}
                  </th>
                  <td className="text-petroleum-500 px-5 py-3.5">
                    {w.language(row.locale)}
                  </td>
                  <td className="px-5 py-3.5">
                    <EmailStatus row={row} />
                    <EmailNotes row={row} savedOn={w.savedOn(row)} />
                  </td>
                  <td className="px-5 py-3.5">
                    {/* A page of its own: a link, so it opens in a new tab too. */}
                    <Button
                      size="sm"
                      variant="outline"
                      href={link.href}
                      aria-label={link.name}
                    >
                      {link.label}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-sand-100 divide-y md:hidden">
        {list.map((row) => {
          if (row.type === "whatsapp") {
            const link = w.whatsappLink(row);
            return (
              <MobileRowCard
                key={row.id}
                title={w.whatsappName(row)}
                facts={[
                  {
                    label: w.column("language"),
                    value: w.language(row.locale),
                  },
                  {
                    label: w.column("status"),
                    value: <WhatsAppStatus row={row} />,
                  },
                ]}
                action={
                  <Button
                    variant="outline"
                    href={link.href}
                    aria-label={link.name}
                    className={MOBILE_ACTION}
                  >
                    {link.label}
                  </Button>
                }
              />
            );
          }
          const link = w.emailLink(row);
          const savedOn = w.savedOn(row);
          return (
            <MobileRowCard
              key={row.id}
              title={w.emailName(row)}
              description={
                <>
                  {w.emailHint(row)}
                  {row.reminderNote && (
                    <>
                      <br />
                      {w.t("reminder.note")}
                    </>
                  )}
                </>
              }
              facts={[
                { label: w.column("language"), value: w.language(row.locale) },
                { label: w.column("status"), value: <EmailStatus row={row} /> },
              ]}
              action={
                <Button
                  variant="outline"
                  href={link.href}
                  aria-label={link.name}
                  className={MOBILE_ACTION}
                >
                  {link.label}
                </Button>
              }
            >
              {(savedOn || row.corrupt) && (
                <EmailNotes row={row} savedOn={savedOn} />
              )}
            </MobileRowCard>
          );
        })}
      </ul>
    </div>
  );
}
