"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconChat, IconMail } from "@/components/ui/icons";
import { MobileRowCard } from "@/components/dashboard/mobile-row-card";
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

/** The name of a message: the link of its row, the one a keyboard reaches. */
const ROW_LINK =
  "text-petroleum-700 focus-visible:ring-petroleum-500 rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none";

/**
 * A click anywhere on a row (or a card) opens the page of its message: it is
 * handed to the row's own link, so the navigation is the link's and nothing is
 * done twice when the link itself was the thing clicked. With Cmd, Ctrl or
 * Shift held it opens in a new tab, as a link does.
 */
function openRow(event: MouseEvent<HTMLElement>) {
  if ((event.target as HTMLElement).closest("a")) return;
  const link =
    event.currentTarget.querySelector<HTMLAnchorElement>("a[data-row-link]");
  if (!link) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey) {
    window.open(link.href, "_blank", "noopener");
    return;
  }
  link.click();
}

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
  /** «Español», or «Español, Inglés»: the languages a state is about. */
  const languages = (list: ("es" | "en")[]) =>
    list.map((l) => t(`locales.${l}`)).join(", ");

  return {
    t,
    tWa,
    languages,
    column: (name: "type" | "status") => t(`columns.${name}`),
    emailName: (row: EmailListRow) => tKeys(row.key),
    emailHint: (row: EmailListRow) => tHints(row.key),
    whatsappName: (row: WhatsAppListRow) => tKeys(row.key),
    // The row opens the message in Spanish; its page has the language switch.
    emailLink: (row: EmailListRow) => ({
      href: messageEditHref("email", row.key, "es"),
      name: t("actions.editRow", { name: tKeys(row.key) }),
    }),
    whatsappLink: (row: WhatsAppListRow) => ({
      href: messageEditHref("whatsapp", row.key, "es"),
      name: tWa(row.saved ? "actions.editRow" : "actions.configureRow", {
        name: tKeys(row.key),
      }),
    }),
    savedOn: (row: EmailListRow) =>
      row.updatedAt
        ? row.updatedByName
          ? t("savedOnBy", {
              date: formatMediumDate(row.updatedAt, locale),
              name: row.updatedByName,
            })
          : t("savedOn", { date: formatMediumDate(row.updatedAt, locale) })
        : null,
  };
}

/** The channel of a row, as a discreet badge with its icon. */
function TypeBadge({ type }: { type: "email" | "whatsapp" }) {
  const t = useTranslations("dashboard.messages.email.types");
  return (
    <span
      // The channel by colour and by icon and name together: WhatsApp green,
      // email blue (the tones of the status badges and of the date variables).
      className={`${PILL} gap-1.5 whitespace-nowrap ${
        type === "email"
          ? "bg-blue-50 text-blue-700"
          : "bg-green-100 text-green-800"
      }`}
    >
      <span aria-hidden="true" className="inline-flex [&>svg]:size-3.5">
        {type === "email" ? <IconMail /> : <IconChat />}
      </span>
      {t(type)}
    </span>
  );
}

/**
 * The state of an email message, over its languages: by default, custom in
 * every language, custom in some (named), or unreadable in some (named); and,
 * for the reminder, switched off.
 */
function EmailStatus({ row }: { row: EmailListRow }) {
  const t = useTranslations("dashboard.messages.email");
  const w = useRowWords();
  const { status } = row;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {row.corrupt.length > 0 && (
        <span className={`${PILL} bg-red-100 text-red-700`}>
          {t("status.corruptIn", { languages: w.languages(row.corrupt) })}
        </span>
      )}
      {(row.corrupt.length === 0 || status.kind !== "default") && (
        <span
          className={`${PILL} text-left ${
            status.kind === "default"
              ? "bg-sand-100 text-petroleum-500"
              : "bg-green-100 text-green-800"
          }`}
        >
          {status.kind === "customSome"
            ? t("status.customSome", {
                languages: w.languages(status.languages),
              })
            : t(status.kind === "custom" ? "status.custom" : "status.default")}
        </span>
      )}
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

/**
 * What a WhatsApp message does today, over its languages. Anything that stops
 * a language from sending is its own line, in red or yellow, with the
 * language; what works is one line (all, or the ones that do). It can be long,
 * so it wraps.
 */
function WhatsAppStatus({ row }: { row: WhatsAppListRow }) {
  const tWa = useTranslations("dashboard.messages.email.whatsapp");
  const w = useRowWords();
  const { summary } = row;
  const trouble =
    summary.problems.length + summary.unknown.length + summary.off.length > 0;
  const pill = (tone: string, text: string, key: string) => (
    <span key={key} className={`${PILL} ${tone} max-w-full text-left`}>
      {text}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {summary.problems.map((p) =>
        pill(
          "bg-red-100 text-red-700",
          tWa("state.invalid", {
            language: w.languages([p.locale]),
            reason: tWa(`issue.${p.issue}`),
          }),
          `problem-${p.locale}`,
        ),
      )}
      {summary.unknown.length > 0 &&
        pill(
          "bg-yellow-100 text-yellow-800",
          tWa("state.unknown", { languages: w.languages(summary.unknown) }),
          "unknown",
        )}
      {summary.off.length > 0 &&
        pill(
          "bg-yellow-100 text-yellow-800",
          tWa("state.off", { languages: w.languages(summary.off) }),
          "off",
        )}
      {summary.level === "all" &&
        pill("bg-green-100 text-green-800", tWa("state.configured"), "ok")}
      {summary.level === "some" &&
        pill(
          "bg-green-100 text-green-800",
          tWa("state.configuredSome", {
            languages: w.languages(summary.configured),
          }),
          "ok",
        )}
      {summary.level === "none" &&
        !trouble &&
        pill("bg-sand-100 text-petroleum-500", tWa("state.none"), "none")}
    </div>
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
      {row.corrupt.length > 0 && (
        <p role="alert" className="mt-1 max-w-xs text-xs text-red-700">
          {t("corrupt")}
        </p>
      )}
    </>
  );
}

/**
 * One row per message and channel: its name, its type (email or WhatsApp) and
 * its state, summed over the languages it is sent in (for the reminder, whether
 * it is switched off too). There is no column of actions: the whole row opens the
 * page where the message is edited or set up, in Spanish, and its name is the
 * link; the language is chosen on that page. Testing, the reminder's switch and
 * resetting are there too.
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
              {(["message", "type", "status"] as const).map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="text-petroleum-400 px-5 py-3 text-xs font-medium whitespace-nowrap"
                >
                  {w.t(`columns.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((row) => {
              const whatsapp = row.type === "whatsapp";
              const link = whatsapp ? w.whatsappLink(row) : w.emailLink(row);
              const savedOn = whatsapp ? null : w.savedOn(row);
              return (
                <tr
                  key={row.id}
                  onClick={openRow}
                  className="border-sand-100 hover:bg-sand-50 cursor-pointer border-b align-top transition-colors last:border-0"
                >
                  <th scope="row" className="px-5 py-3.5 text-left font-normal">
                    <p>
                      {/* A page of its own: a link, so it opens in a new tab too. */}
                      <Link
                        href={link.href}
                        aria-label={link.name}
                        data-row-link
                        className={ROW_LINK}
                      >
                        {whatsapp ? w.whatsappName(row) : w.emailName(row)}
                      </Link>
                    </p>
                    {!whatsapp && (
                      <p className="text-petroleum-400 mt-0.5 max-w-full text-xs">
                        {w.emailHint(row)}
                      </p>
                    )}
                    {!whatsapp && row.reminderNote && (
                      <p className="text-petroleum-400 mt-1 max-w-full text-xs">
                        {w.t("reminder.note")}
                      </p>
                    )}
                  </th>
                  <td className="px-5 py-3.5">
                    <TypeBadge type={row.type} />
                  </td>
                  <td className="px-5 py-3.5">
                    {whatsapp ? (
                      <WhatsAppStatus row={row} />
                    ) : (
                      <>
                        <EmailStatus row={row} />
                        <EmailNotes row={row} savedOn={savedOn} />
                      </>
                    )}
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
          const whatsapp = row.type === "whatsapp";
          const link = whatsapp ? w.whatsappLink(row) : w.emailLink(row);
          const savedOn = whatsapp ? null : w.savedOn(row);
          return (
            <MobileRowCard
              key={row.id}
              onClick={openRow}
              title={
                <Link
                  href={link.href}
                  aria-label={link.name}
                  data-row-link
                  className={`${ROW_LINK} inline-flex min-h-11 items-center`}
                >
                  {whatsapp ? w.whatsappName(row) : w.emailName(row)}
                </Link>
              }
              description={
                whatsapp ? undefined : (
                  <>
                    {w.emailHint(row)}
                    {row.reminderNote && (
                      <>
                        <br />
                        {w.t("reminder.note")}
                      </>
                    )}
                  </>
                )
              }
              facts={[
                {
                  label: w.column("type"),
                  value: <TypeBadge type={row.type} />,
                },
                {
                  label: w.column("status"),
                  value: whatsapp ? (
                    <WhatsAppStatus row={row} />
                  ) : (
                    <EmailStatus row={row} />
                  ),
                },
              ]}
            >
              {!whatsapp && (savedOn || row.corrupt.length > 0) && (
                <EmailNotes row={row} savedOn={savedOn} />
              )}
            </MobileRowCard>
          );
        })}
      </ul>
    </div>
  );
}
