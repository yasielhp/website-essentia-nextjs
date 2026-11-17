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
import { MessageEditor } from "./message-editor";
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
  const [editing, setEditing] = useState<{
    key: MessageKey;
    locale: Locale;
  } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

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
  ) {
    setBusyKey(`${key}:${locale}`);
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

  const editor = editing
    ? {
        saved:
          state.rows.find(
            (r) =>
              r.channel === "email" &&
              r.key === editing.key &&
              r.locale === editing.locale,
          ) ?? null,
        defaults: state.defaults.find(
          (d) => d.key === editing.key && d.locale === editing.locale,
        ),
        catalog: state.catalog.find((c) => c.key === editing.key),
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-petroleum-400 max-w-2xl text-sm">{t("intro")}</p>
      <MessageList
        rows={state.rows}
        catalog={state.catalog}
        busyKey={busyKey}
        onEdit={(key, locale) => setEditing({ key, locale })}
        onTest={(key, locale) => void test(key, locale)}
        onReset={(key, locale) => void reset(key, locale)}
        onToggle={(key, locale, enabled) => void toggle(key, locale, enabled)}
      />
      {editing && editor?.defaults && editor.catalog && (
        <MessageEditor
          messageKey={editing.key}
          locale={editing.locale}
          saved={editor.saved}
          defaults={editor.defaults}
          catalog={editor.catalog}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
