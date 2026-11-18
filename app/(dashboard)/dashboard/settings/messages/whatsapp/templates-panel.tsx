"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@/components/ui/icons";
import {
  listWhatsAppTemplates,
  syncWhatsAppTemplates,
} from "@/actions/whatsapp-templates";
import { getAccessToken } from "@/lib/client-session";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { shouldAutoSync } from "@/lib/whatsapp/auto-sync";
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

/**
 * When this browser last asked Meta for the templates. Kept outside the
 * component so leaving the tab and coming back does not ask again at once.
 */
let lastAutoSyncAt: number | null = null;

/**
 * The WhatsApp tab: the list and the create form.
 *
 * Nobody syncs by hand. The list is shown at once from the dashboard's copy
 * and, when that copy is not fresh, Meta is asked in the background and the
 * list redrawn (`shouldAutoSync`); a cron does the same every hour. Only a sync
 * that fails asks anything of the admin: a notice with a way to try again.
 *
 * Its button belongs at the top right of the page, beside the title, so it is
 * drawn into `actionsSlot`, the place the page's header keeps for it (`null`
 * until the header has mounted). With no slot at all, as when the panel is
 * drawn on its own, it stays above the list.
 */
export function TemplatesPanel({
  actionsSlot,
}: {
  actionsSlot?: HTMLElement | null;
} = {}) {
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
  const [syncFailed, setSyncFailed] = useState(false);
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

  /** Asks Meta, quietly: the list is redrawn if it answers, a notice if not. */
  async function syncNow() {
    lastAutoSyncAt = Date.now();
    setSyncing(true);
    setSyncFailed(false);
    try {
      const result = await syncWhatsAppTemplates(getAccessToken());
      if (result.ok) reload();
      else setSyncFailed(true);
    } catch {
      setSyncFailed(true);
    } finally {
      setSyncing(false);
    }
  }

  // Once the copy is on screen, bring it up to date if it is not fresh. Asked
  // a moment later, not in the effect itself, and not at all if the tab was
  // left in between.
  useEffect(() => {
    if (loading || failed) return;
    if (
      !shouldAutoSync({
        configured,
        lastSyncMs: lastSync,
        lastAttemptMs: lastAutoSyncAt,
        nowMs: Date.now(),
      })
    ) {
      return;
    }
    const timer = setTimeout(() => void syncNow(), 0);
    return () => clearTimeout(timer);
    // `syncNow` is a new function each render; this runs when the list settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, failed, configured, lastSync]);

  const actions = (
    <Button className="gap-2" onClick={() => setForm(null)}>
      <IconPlus />
      {t("new")}
    </Button>
  );
  const updatedAt =
    lastSync === null
      ? null
      : new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Atlantic/Canary",
        }).format(lastSync);

  return (
    <div>
      {actionsSlot && createPortal(actions, actionsSlot)}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-petroleum-400 max-w-full text-sm">{t("intro")}</p>
          {/* When the copy was last brought from Meta; it brings itself. */}
          {configured && (syncing || updatedAt) && (
            <p role="status" className="text-petroleum-400 mt-1 text-xs">
              {syncing
                ? t("autoSync.updating")
                : t("autoSync.updated", { date: updatedAt ?? "" })}
            </p>
          )}
        </div>
        {actionsSlot === undefined && (
          <div className="flex max-w-full flex-wrap gap-3">{actions}</div>
        )}
      </div>

      {syncFailed && !syncing && (
        <div
          role="alert"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-yellow-300 bg-yellow-50 px-5 py-4 text-sm text-yellow-800"
        >
          <p>{t("autoSync.failed")}</p>
          <Button variant="outline" size="sm" onClick={() => void syncNow()}>
            {t("retry")}
          </Button>
        </div>
      )}

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
