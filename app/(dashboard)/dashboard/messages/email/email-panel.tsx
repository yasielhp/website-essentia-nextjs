"use client";

import { useEffect, useReducer, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { listMessageTemplates } from "@/actions/message-templates";
import { getAccessToken } from "@/lib/client-session";
import type {
  MessageCatalogEntry,
  MessageDefaultEntry,
  MessageTemplateRowView,
} from "@/lib/messages/types";
import { useEmailActionToast } from "./action-error";
import { useWhatsAppTemplates } from "../../campaigns/_form/use-whatsapp-templates";
import { MessageList } from "./message-list";

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
        templates={templateRows}
      />
    </div>
  );
}
