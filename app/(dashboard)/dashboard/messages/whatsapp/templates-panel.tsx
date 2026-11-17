"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@/components/ui/icons";
import {
  listWhatsAppTemplates,
  syncWhatsAppTemplates,
} from "@/actions/whatsapp-templates";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { latestSync } from "@/lib/whatsapp/template-ui";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";
import { useActionToast } from "./action-error";
import { TemplateDetail } from "./template-detail";
import { TemplateForm } from "./template-form";
import { TemplateTable } from "./template-table";

type ListState = {
  templates: WhatsAppTemplateRow[];
  /** False when the server has no WABA id: templates stay drafts. */
  configured: boolean;
  loading: boolean;
  failed: boolean;
};

type ListAction =
  | { type: "loading" }
  | { type: "loaded"; templates: WhatsAppTemplateRow[]; configured: boolean }
  | { type: "failed" };

function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case "loading":
      return { ...state, loading: true, failed: false };
    case "loaded":
      return {
        templates: action.templates,
        configured: action.configured,
        loading: false,
        failed: false,
      };
    case "failed":
      return { ...state, loading: false, failed: true };
  }
}

/** The WhatsApp tab: the list, the sync and the create form. */
export function TemplatesPanel() {
  const t = useTranslations("dashboard.messages.whatsapp");
  const locale = useDashboardLocale();
  const showError = useActionToast();

  const [{ templates, configured, loading, failed }, dispatch] = useReducer(
    listReducer,
    // Until the first answer, assume the server is set up: the draft warning
    // must not flash on a page that is about to say otherwise.
    { templates: [], configured: true, loading: true, failed: false },
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  /** `undefined` closed; `null` a blank form; a row, a rewrite of that one. */
  const [form, setForm] = useState<WhatsAppTemplateRow | null | undefined>(
    undefined,
  );
  const [detail, setDetail] = useState<WhatsAppTemplateRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "loading" });
    void listWhatsAppTemplates(getAccessToken())
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          dispatch({
            type: "loaded",
            templates: result.templates,
            configured: result.configured,
          });
        } else {
          dispatch({ type: "failed" });
          showError(result);
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "failed" });
      });
    return () => {
      cancelled = true;
    };
    // `showError` is a new function each render; the list reloads on `reloadKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);
  const lastSync = useMemo(() => latestSync(templates), [templates]);
  const takenNames = useMemo(() => templates.map((x) => x.name), [templates]);

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncWhatsAppTemplates(getAccessToken());
      if (result.ok) {
        notifySuccess(t("toasts.synced", { count: result.count }));
        if (result.skipped > 0) {
          toast.info(t("toasts.skipped", { count: result.skipped }));
        }
        reload();
      } else {
        showError(result);
      }
    } catch {
      showError({ error: "generic" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <p className="text-petroleum-400 max-w-2xl text-sm">{t("intro")}</p>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => void handleSync()}
            disabled={syncing || !configured}
            title={configured ? undefined : t("syncUnavailable")}
          >
            {syncing ? t("syncing") : t("sync")}
          </Button>
          <Button className="gap-2" onClick={() => setForm(null)}>
            <IconPlus />
            {t("new")}
          </Button>
        </div>
      </div>

      {!configured && (
        <p
          role="status"
          className="mb-6 rounded-2xl border border-yellow-300 bg-yellow-50 px-5 py-4 text-sm text-yellow-800"
        >
          {t("notConfigured")}
        </p>
      )}

      {failed ? (
        <div className="border-sand-200 flex flex-col items-center gap-4 rounded-2xl border bg-white px-6 py-16 text-center">
          <p className="text-petroleum-400 text-sm">{t("loadFailed")}</p>
          <Button variant="outline" onClick={reload}>
            {t("retry")}
          </Button>
        </div>
      ) : (
        <TemplateTable
          templates={templates}
          loading={loading}
          configured={configured}
          lastSync={lastSync}
          locale={locale}
          onOpen={setDetail}
        />
      )}

      {detail && (
        <TemplateDetail
          template={detail}
          configured={configured}
          lastSync={lastSync}
          onClose={() => setDetail(null)}
          onUseAnotherName={(template) => {
            setDetail(null);
            setForm(template);
          }}
        />
      )}

      {form !== undefined && (
        <TemplateForm
          seed={form}
          configured={configured}
          takenNames={takenNames}
          onClose={() => setForm(undefined)}
          onCreated={() => {
            setForm(undefined);
            reload();
          }}
        />
      )}
    </div>
  );
}
