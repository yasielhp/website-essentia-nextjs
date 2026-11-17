"use client";

import { useEffect, useReducer, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  listMessageTemplates,
  resetMessageTemplate,
  saveMessageTemplate,
  sendTestMessage,
} from "@/actions/message-templates";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import type { MessageKey } from "@/lib/messages/catalog";
import type {
  MessageCatalogEntry,
  MessageDefaultEntry,
  MessageTemplateRowView,
} from "@/lib/messages/types";
import { useEmailActionToast } from "./action-error";
import { useWhatsAppTemplates } from "../../campaigns/_form/use-whatsapp-templates";
import { MessageList } from "./message-list";

type Locale = "es" | "en";

type ListState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      rows: MessageTemplateRowView[];
      defaults: MessageDefaultEntry[];
      catalog: MessageCatalogEntry[];
    };

type ListAction =
  | { type: "loading" }
  | { type: "error" }
  | {
      type: "ready";
      rows: MessageTemplateRowView[];
      defaults: MessageDefaultEntry[];
      catalog: MessageCatalogEntry[];
    };

function reducer(_: ListState, action: ListAction): ListState {
  if (action.type === "loading") return { status: "loading" };
  if (action.type === "error") return { status: "error" };
  return {
    status: "ready",
    rows: action.rows,
    defaults: action.defaults,
    catalog: action.catalog,
  };
}

/** The Emails tab: every message the system sends to clients, and its editor. */
export function EmailPanel() {
  const t = useTranslations("dashboard.messages.email");
  const showError = useEmailActionToast();
  const [state, dispatch] = useReducer(reducer, { status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // The WhatsApp rows need the account's templates; the email half does not,
  // so a failure to read them leaves those rows saying "could not be checked".
  const waTemplates = useWhatsAppTemplates(true, reloadKey);
  const templateRows =
    waTemplates.status === "ready" ? waTemplates.templates : null;

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "loading" });
    void listMessageTemplates(getAccessToken())
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          dispatch({
            type: "ready",
            rows: result.rows,
            defaults: result.defaults,
            catalog: result.catalog,
          });
        } else {
          dispatch({ type: "error" });
          showError(result);
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "error" });
      });
    return () => {
      cancelled = true;
    };
    // `showError` is a new function each render; the list reloads on `reloadKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const reload = () => setReloadKey((n) => n + 1);

  /** Runs one action on one row, with its busy state and a failure toast. */
  async function run(
    key: MessageKey,
    locale: Locale,
    action: () => Promise<void>,
    channel: "email" | "wa" = "email",
  ) {
    setBusyKey(channel === "wa" ? `wa:${key}:${locale}` : `${key}:${locale}`);
    try {
      await action();
    } catch {
      showError({ error: "generic" });
    } finally {
      setBusyKey(null);
    }
  }

  const toggle = (key: MessageKey, locale: Locale, enabled: boolean) =>
    run(key, locale, async () => {
      // Only the switch: the text, if any, is not touched.
      const result = await saveMessageTemplate(getAccessToken(), {
        key,
        channel: "email",
        locale,
        enabled,
      });
      if (!result.ok) return showError(result);
      notifySuccess(enabled ? t("reminder.turnedOn") : t("reminder.turnedOff"));
      reload();
    });

  const test = (key: MessageKey, locale: Locale) =>
    run(key, locale, async () => {
      const result = await sendTestMessage(
        getAccessToken(),
        key,
        "email",
        locale,
      );
      if (!result.ok) return showError(result);
      notifySuccess(t("testSent", { email: result.to }));
    });

  const reset = (key: MessageKey, locale: Locale) =>
    run(key, locale, async () => {
      const result = await resetMessageTemplate(
        getAccessToken(),
        key,
        "email",
        locale,
      );
      if (!result.ok) return showError(result);
      if (result.kept === "disabled") toast.info(t("resetKeptDisabled"));
      else if (result.removed) notifySuccess(t("resetDone"));
      else toast.info(t("resetNothing"));
      reload();
    });

  const waTest = (key: MessageKey, locale: Locale) =>
    run(
      key,
      locale,
      async () => {
        const result = await sendTestMessage(
          getAccessToken(),
          key,
          "whatsapp",
          locale,
        );
        if (!result.ok) return showError(result);
        notifySuccess(t("whatsapp.editor.testSent", { phone: result.to }));
      },
      "wa",
    );

  const waRemove = (key: MessageKey, locale: Locale) =>
    run(
      key,
      locale,
      async () => {
        // Stopping the WhatsApp notice is deleting its row.
        const result = await resetMessageTemplate(
          getAccessToken(),
          key,
          "whatsapp",
          locale,
        );
        if (!result.ok) return showError(result);
        notifySuccess(t("whatsapp.removed"));
        reload();
      },
      "wa",
    );

  if (state.status === "loading") {
    return <div className="bg-sand-100 h-64 animate-pulse rounded-2xl" />;
  }
  if (state.status === "error") {
    return (
      <div className="border-sand-200 flex flex-col items-center gap-4 rounded-2xl border bg-white px-6 py-16 text-center">
        <p className="text-petroleum-400 text-sm">{t("loadFailed")}</p>
        <Button variant="outline" onClick={reload}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-petroleum-400 max-w-2xl text-sm">{t("intro")}</p>
      {waTemplates.status === "error" && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
        >
          <p>{t("whatsapp.templatesFailed")}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            {t("retry")}
          </Button>
        </div>
      )}
      <MessageList
        rows={state.rows}
        catalog={state.catalog}
        busyKey={busyKey}
        onTest={(key, locale) => void test(key, locale)}
        onReset={(key, locale) => void reset(key, locale)}
        onToggle={(key, locale, enabled) => void toggle(key, locale, enabled)}
        templates={templateRows}
        onWaTest={(key, locale) => void waTest(key, locale)}
        onWaRemove={(key, locale) => void waRemove(key, locale)}
      />
    </div>
  );
}
