"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useDialogFocus } from "@/hooks/use-dialog-focus";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { resetMessageTemplate } from "@/actions/message-templates";
import { messageListHref } from "@/lib/messages/message-route";
import type { MessageKey } from "@/lib/messages/catalog";
import { toast } from "sonner";
import { ConfirmDialog } from "./confirm-dialog";
import { useEmailActionText } from "./action-error";
import { runReset } from "@/lib/messages/reset-run";

/**
 * The top of a message's own page, as the other pages of the dashboard lay
 * theirs out: the title (with its state) on the left, the actions on the right,
 * stacked on a phone. The title takes focus when the page opens, so a screen
 * reader starts on it and the next thing to reach is the actions, then the form.
 * The way back to the list is the crumb above, not a button.
 *
 * `help` describes the test button. It is a small line under the title only
 * when it tells the admin something to do (save first); what the test sends is
 * left to a screen reader (`quiet`), since the button already says it.
 */
export function MessagePageHeader({
  title,
  status,
  extraStatus,
  describedBy,
  help,
  actions,
}: {
  title: string;
  /** "Custom" or "Default", already in words; absent while unknown. */
  status?: { text: string; tone: "custom" | "default" } | null;
  /** A second state beside it, such as "Switched off". */
  extraStatus?: string;
  describedBy?: string;
  help?: { id: string; text: string; quiet?: boolean };
  actions?: React.ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id="message-title"
            ref={heading}
            tabIndex={-1}
            aria-describedby={describedBy}
            className="font-display text-petroleum-700 text-3xl outline-none"
          >
            {title}
          </h1>
          {status && (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
                status.tone === "custom"
                  ? "bg-green-100 text-green-800"
                  : "bg-sand-100 text-petroleum-500"
              }`}
            >
              {status.text}
            </span>
          )}
          {extraStatus && (
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-yellow-800">
              {extraStatus}
            </span>
          )}
        </div>
        {help && (
          <p
            id={help.id}
            className={
              help.quiet
                ? "sr-only"
                : "text-petroleum-400 mt-1.5 max-w-xl text-xs"
            }
          >
            {help.text}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}

/**
 * "Unsaved changes" when a link was clicked: stay, or leave without saving.
 * It exists only while it is asked, and focus goes to "keep editing" and, on
 * keeping, back to the title.
 */
export function UnsavedBar({
  onStay,
  onLeave,
}: {
  onStay: () => void;
  onLeave: () => void;
}) {
  const t = useTranslations("dashboard.messages.email.editor");
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, () => document.getElementById("message-title"));
  return (
    <div
      ref={ref}
      role="alertdialog"
      aria-label={t("discardTitle")}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-yellow-50 px-4 py-3"
    >
      <p className="text-sm font-medium text-yellow-800">{t("discardTitle")}</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onStay}>
          {t("discardNo")}
        </Button>
        <Button variant="danger" onClick={onLeave}>
          {t("discardYes")}
        </Button>
      </div>
    </div>
  );
}

export type ResetLabels = {
  /** The button that opens the dialog, and what it says while the reset runs. */
  button: string;
  working: string;
  /** The question, naming the message (and the language, for an email). */
  title: string;
  body: string;
  /** Only when it matters before saying yes: the reminder stays off. */
  note?: string;
  yes: string;
  no: string;
};

/**
 * "Reset": resets the message to its default (or removes its WhatsApp notice)
 * and goes back to the list, which loads fresh when it opens. The question is
 * asked in a modal dialog (`ResetDialog`) and the button that starts it is
 * `ResetButton`, so the page can put the button in its header.
 */
export function useMessageReset({
  channel,
  messageKey,
  locale,
  onBeforeLeave,
}: {
  channel: "email" | "whatsapp";
  messageKey: MessageKey;
  locale: "es" | "en";
  /** Called once the reset worked, before the page is left. */
  onBeforeLeave?: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("dashboard.messages.email");
  const failureText = useEmailActionText();
  const [asking, setAskingState] = useState(false);
  const [busy, setBusy] = useState(false);
  // Why the last try failed: shown inside the dialog, which stays open.
  const [error, setError] = useState<string | null>(null);

  function setAsking(value: boolean) {
    setError(null);
    setAskingState(value);
  }

  async function reset() {
    setBusy(true);
    setError(null);
    const outcome = await runReset(channel, () =>
      resetMessageTemplate(getAccessToken(), messageKey, channel, locale),
    );
    if (outcome.status === "failed") {
      const text = failureText(outcome.failure);
      setError(
        text.description ? `${text.title} ${text.description}` : text.title,
      );
      setBusy(false);
      return;
    }
    switch (outcome.notice) {
      case "whatsappRemoved":
        notifySuccess(t("whatsapp.removed"));
        break;
      case "keptDisabled":
        toast.info(t("resetKeptDisabled"));
        break;
      case "done":
        notifySuccess(t("resetDone"));
        break;
      default:
        toast.info(t("resetNothing"));
    }
    onBeforeLeave?.();
    router.push(messageListHref());
  }

  return { asking, setAsking, busy, error, reset };
}

export function ResetButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      id="message-reset-button"
      variant="ghost"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

/** The question, in a modal dialog over the page: nothing under the header moves. */
export function ResetDialog({
  labels,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  labels: ResetLabels;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      title={labels.title}
      body={labels.body}
      note={labels.note}
      error={error}
      yesLabel={labels.yes}
      workingLabel={labels.working}
      noLabel={labels.no}
      returnTo="message-reset-button"
      busy={busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

/** Button and question together, for a page with no header actions (the unreadable row). */
export function ResetControl({
  channel,
  messageKey,
  locale,
  labels,
}: {
  channel: "email" | "whatsapp";
  messageKey: MessageKey;
  locale: "es" | "en";
  labels: ResetLabels;
}) {
  const { asking, setAsking, busy, error, reset } = useMessageReset({
    channel,
    messageKey,
    locale,
  });
  return (
    <>
      <ResetButton
        label={busy ? labels.working : labels.button}
        disabled={busy}
        onClick={() => setAsking(true)}
      />
      {asking && (
        <ResetDialog
          labels={labels}
          busy={busy}
          error={error}
          onCancel={() => setAsking(false)}
          onConfirm={() => void reset()}
        />
      )}
    </>
  );
}

/**
 * A draft from before the page was left: offered, never applied by itself. The
 * message is the text that was typed and not saved, only on this tab.
 */
export function DraftBanner({
  onRecover,
  onDiscard,
}: {
  onRecover: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("dashboard.messages.email.draft");
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-yellow-50 px-4 py-3"
    >
      <p className="text-sm font-medium text-yellow-800">{t("notice")}</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onDiscard}>
          {t("discard")}
        </Button>
        <Button onClick={onRecover}>{t("recover")}</Button>
      </div>
    </div>
  );
}
