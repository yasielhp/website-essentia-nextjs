"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { IconArrowLeft } from "@/components/ui/icons";
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
 * The top of a message's own page: the way back to the list, the title (which
 * takes focus when the page opens, so a screen reader starts on it) and the
 * state of the message.
 */
export function MessagePageHeader({
  title,
  status,
  extraStatus,
  describedBy,
}: {
  title: string;
  /** "Custom" or "Default", already in words; absent while unknown. */
  status?: { text: string; tone: "custom" | "default" } | null;
  /** A second state beside it, such as "Switched off". */
  extraStatus?: string;
  describedBy?: string;
}) {
  const t = useTranslations("dashboard.messages.email.page");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <header className="flex flex-col gap-3">
      <Link
        id="message-back-link"
        href={messageListHref()}
        className="text-petroleum-500 hover:text-petroleum-700 focus-visible:ring-petroleum-500 inline-flex w-fit items-center gap-1.5 rounded text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <IconArrowLeft />
        {t("back")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1
          ref={heading}
          tabIndex={-1}
          aria-describedby={describedBy}
          className="font-display text-petroleum-700 text-2xl outline-none"
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
    </header>
  );
}

/**
 * "Unsaved changes" when a link was clicked: stay, or leave without saving.
 * It exists only while it is asked, and focus goes to "keep editing" and, on
 * keeping, back to the way back.
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
  useDialogFocus(ref, () => document.getElementById("message-back-link"));
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

/**
 * "Reset": asks in place, resets the message to its default (or removes its
 * WhatsApp notice) and goes back to the list, which loads fresh when it opens.
 */
export function ResetControl({
  channel,
  messageKey,
  locale,
  labels,
  disabled,
  onBeforeLeave,
}: {
  channel: "email" | "whatsapp";
  messageKey: MessageKey;
  locale: "es" | "en";
  labels: {
    button: string;
    working: string;
    confirm: string;
    yes: string;
    no: string;
  };
  disabled?: boolean;
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

  if (asking) {
    return (
      <ConfirmBar
        message={labels.confirm}
        yesLabel={labels.yes}
        noLabel={labels.no}
        returnTo="message-reset-button"
        busy={busy}
        onCancel={() => setAsking(false)}
        onConfirm={() => void reset()}
      />
    );
  }
  return (
    <Button
      id="message-reset-button"
      variant="ghost"
      disabled={disabled || busy}
      onClick={() => setAsking(true)}
    >
      {busy ? labels.working : labels.button}
    </Button>
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
