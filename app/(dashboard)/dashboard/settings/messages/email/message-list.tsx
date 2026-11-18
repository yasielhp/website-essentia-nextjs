"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconChat, IconMail } from "@/components/ui/icons";
import { setMessageEnabled } from "@/actions/message-templates";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { MobileRowCard } from "@/components/dashboard/mobile-row-card";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { messageEditHref } from "@/lib/messages/message-route";
import {
  messageListRows,
  type EmailListRow,
  type ListRow,
  type WhatsAppListRow,
} from "@/lib/messages/list-rows";
import {
  switchTarget,
  type SwitchSummary,
} from "@/lib/messages/reminder-switch";
import { ConfirmDialog } from "./confirm-dialog";
import { MessageSwitch } from "./message-switch";
import { useEmailActionText, useEmailActionToast } from "./action-error";
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
export function openRow(event: MouseEvent<HTMLElement>) {
  // A link is its own, and so is the switch of the row: pressing it must not
  // also open the message.
  if ((event.target as HTMLElement).closest('a, button, [role="switch"]')) {
    return;
  }
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
    column: (name: "type" | "content") => t(`columns.${name}`),
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
 * every language, custom in some (named), or unreadable in some (named).
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
  const trouble = summary.problems.length + summary.unknown.length > 0;
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

/** The switch of a row with what a click on it will do, once the row's own saved state is known. */
function effective(
  row: ListRow,
  pending: Record<string, boolean>,
): SwitchSummary {
  const forced = pending[row.id];
  if (forced === undefined) return row.switch;
  return {
    state: forced ? "on" : "off",
    offLocales: forced ? [] : [...row.locales],
  };
}

/**
 * The switches of the list: their state (what was saved, or what was just
 * asked and is being saved), the question that comes before TURNING OFF (a
 * modal, with what it will stop, message by message) and the saving.
 *
 * Turning on is not asked and is shown at once, with a loading state, and put
 * back with a notice if it fails. Turning off is asked first; the dialog is the
 * loading state, shows a failure inside it and closes on success. A row that is
 * partly off (old data) is turned ON, which makes both languages agree.
 */
function useRowSwitches() {
  const t = useTranslations("dashboard.messages.email");
  const tKeys = useTranslations("dashboard.messages.keys");
  const w = useRowWords();
  const showError = useEmailActionToast();
  const failureText = useEmailActionText();
  // What each row was last told to be, until the page is loaded again.
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [asking, setAsking] = useState<ListRow | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const stateOf = (row: ListRow) => effective(row, done);
  const busyRows = (row: ListRow) => saving[row.id] === true;

  async function write(row: ListRow, enabled: boolean): Promise<string | null> {
    setSaving((now) => ({ ...now, [row.id]: true }));
    const before = done[row.id];
    // Turning on shows at once; turning off waits for the answer (the dialog
    // is where it is shown to be working).
    if (enabled) setDone((now) => ({ ...now, [row.id]: true }));
    let problem: string | null = null;
    try {
      const result = await setMessageEnabled(
        getAccessToken(),
        row.key,
        row.type,
        enabled,
      );
      if (result.ok) {
        setDone((now) => ({ ...now, [row.id]: enabled }));
        if (enabled) notifySuccess(t("switch.turnedOn"));
      } else {
        const text = failureText(result);
        problem = text.description
          ? `${text.title} ${text.description}`
          : text.title;
        if (enabled) showError(result);
      }
    } catch {
      problem = failureText({ error: "generic" }).title;
      if (enabled) showError({ error: "generic" });
    }
    if (problem !== null && enabled) {
      // Put back: it did not save.
      setDone((now) => {
        const next = { ...now };
        if (before === undefined) delete next[row.id];
        else next[row.id] = before;
        return next;
      });
    }
    setSaving((now) => {
      const next = { ...now };
      delete next[row.id];
      return next;
    });
    return problem;
  }

  function press(row: ListRow) {
    if (busyRows(row)) return;
    const summary = stateOf(row);
    if (switchTarget(summary)) {
      void write(row, true);
    } else {
      setFailure(null);
      setAsking(row);
    }
  }

  const typeName = (row: ListRow) => t(`switch.channel.${row.type}`);

  const control = (row: ListRow) => {
    // A WhatsApp row with no template in any language has nothing to switch
    // on: it is DRAWN off and cannot be pressed, and nothing is written to say
    // so. With a template the switch shows what is saved (on by default).
    const notSetUp = row.type === "whatsapp" && !row.hasTemplate;
    const summary: SwitchSummary = notSetUp
      ? { state: "off", offLocales: [...row.locales] }
      : stateOf(row);
    const name = tKeys(row.key);
    return (
      <span className="flex flex-col items-start gap-0.5">
        <MessageSwitch
          id={`message-switch-${row.id.replace(/[^a-z0-9_-]/gi, "-")}`}
          label={t("switch.label", { name, type: typeName(row) })}
          checked={summary.state === "on"}
          busy={busyRows(row)}
          locked={notSetUp ? t("switch.needsSetup") : undefined}
          onToggle={() => press(row)}
        />
        {!notSetUp && summary.state === "partial" && (
          <span className="text-petroleum-400 text-xs">
            {t("switch.partial", {
              languages: w.languages(summary.offLocales),
            })}
          </span>
        )}
      </span>
    );
  };

  const dialog = asking ? (
    <ConfirmDialog
      title={t("switch.offDialog.title", {
        name: tKeys(asking.key),
        type: typeName(asking),
      })}
      body={t(`switch.offDialog.body.${asking.type}.${asking.key}`)}
      error={failure}
      yesLabel={t("switch.offDialog.yes")}
      workingLabel={t("switch.offDialog.working")}
      noLabel={t("resetNo")}
      returnTo={`message-switch-${asking.id.replace(/[^a-z0-9_-]/gi, "-")}`}
      busy={busyRows(asking)}
      onCancel={() => setAsking(null)}
      onConfirm={() => {
        const row = asking;
        void write(row, false).then((problem) => {
          if (problem === null) setAsking(null);
          else setFailure(problem);
        });
      }}
    />
  ) : null;

  return { control, dialog };
}

/**
 * One row per message and channel: its name, its type (email or WhatsApp) and
 * its state, summed over the languages it is sent in (for the reminder, whether
 * it is switched off too). There is no column of actions: the whole row opens the
 * page where the message is edited or set up, in Spanish, and its name is the
 * link; the language is chosen on that page. Testing and resetting are there
 * too. The last column is the row's switch (all its languages together); it is
 * the one thing on a row that is not the link.
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
  const switches = useRowSwitches();

  return (
    <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
      {switches.dialog}
      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-sand-100 border-b text-left">
              {(["switch", "message", "type", "content"] as const).map(
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
              const whatsapp = row.type === "whatsapp";
              const link = whatsapp ? w.whatsappLink(row) : w.emailLink(row);
              const savedOn = whatsapp ? null : w.savedOn(row);
              return (
                <tr
                  key={row.id}
                  onClick={openRow}
                  className="border-sand-100 hover:bg-sand-50 cursor-pointer border-b align-top transition-colors last:border-0"
                >
                  <td className="px-5 py-1.5 md:py-2.5">
                    {switches.control(row)}
                  </td>
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
                <span className="flex items-start gap-3">
                  {switches.control(row)}
                  <Link
                    href={link.href}
                    aria-label={link.name}
                    data-row-link
                    className={`${ROW_LINK} inline-flex min-h-11 items-center`}
                  >
                    {whatsapp ? w.whatsappName(row) : w.emailName(row)}
                  </Link>
                </span>
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
                  label: w.column("content"),
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
