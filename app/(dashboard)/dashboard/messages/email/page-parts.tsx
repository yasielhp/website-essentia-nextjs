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
import { ConfirmBar } from "./confirm-bar";
import { useEmailActionToast } from "./action-error";

/**
 * The top of a message's own page, as the other pages of the dashboard lay
 * theirs out: the title (with its state) on the left, the actions on the right,
 * stacked on a phone. The title takes focus when the page opens, so a screen
 * reader starts on it and the next thing to reach is the actions, then the form.
 * The way back to the list is the crumb above, not a button.
 *
 * `help` is the small line under the title; the test button is described by it.
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
  help?: { id: string; text: string };
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
            className="text-petroleum-400 mt-1.5 max-w-xl text-xs"
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

type ResetLabels = {
  button: string;
  working: string;
  confirm: string;
  yes: string;
  no: string;
};

/**
 * "Reset": resets the message to its default (or removes its WhatsApp notice)
 * and goes back to the list, which loads fresh when it opens. The question is
 * asked by `ResetConfirm` and the button that starts it is `ResetButton`, so the
 * page can put the button in its header and the question under it.
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
  const showError = useEmailActionToast();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    try {
      const result = await resetMessageTemplate(
        getAccessToken(),
        messageKey,
        channel,
        locale,
      );
      if (!result.ok) {
        showError(result);
        setBusy(false);
        setAsking(false);
        return;
      }
      if (channel === "whatsapp") notifySuccess(t("whatsapp.removed"));
      else if (result.kept === "disabled") toast.info(t("resetKeptDisabled"));
      else if (result.removed) notifySuccess(t("resetDone"));
      else toast.info(t("resetNothing"));
      onBeforeLeave?.();
      router.push(messageListHref());
    } catch {
      showError({ error: "generic" });
      setBusy(false);
      setAsking(false);
    }
  }

  return { asking, setAsking, busy, reset };
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

/** The question, in place of nothing: it goes under the header, where it moves nothing. */
export function ResetConfirm({
  labels,
  busy,
  onCancel,
  onConfirm,
}: {
  labels: ResetLabels;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmBar
      message={labels.confirm}
      yesLabel={labels.yes}
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
  const { asking, setAsking, busy, reset } = useMessageReset({
    channel,
    messageKey,
    locale,
  });
  if (asking) {
    return (
      <ResetConfirm
        labels={labels}
        busy={busy}
        onCancel={() => setAsking(false)}
        onConfirm={() => void reset()}
      />
    );
  }
  return (
    <ResetButton
      label={busy ? labels.working : labels.button}
      onClick={() => setAsking(true)}
    />
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
