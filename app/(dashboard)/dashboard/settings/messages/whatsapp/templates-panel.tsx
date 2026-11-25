"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@/components/ui/icons";
import {
  listWhatsAppTemplates,
  syncWhatsAppTemplates,
} from "@/actions/whatsapp-templates";
import { getAccessToken } from "@/lib/client-session";
import { newWhatsAppTemplateHref } from "@/lib/messages/message-route";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { useNow } from "@/hooks/use-now";
import { shouldAutoSync } from "@/lib/whatsapp/auto-sync";
import { latestSync } from "@/lib/whatsapp/template-ui";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";
import { useActionToast } from "./action-error";
import { SyncStamp } from "./sync-stamp";
import { TemplateDetail } from "./template-detail";
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
 * component so leaving the page and coming back does not ask again at once.
 */
let lastAutoSyncAt: number | null = null;

/**
 * The WhatsApp templates card: the list, and the way to the page where a new
 * template is written (`newWhatsAppTemplateHref`).
 *
 * Nobody syncs by hand. The list is shown at once from the dashboard's copy
 * and, when that copy is not fresh, Meta is asked in the background and the
 * list redrawn (`shouldAutoSync`); a cron does the same every hour. Only a sync
 * that fails asks anything of the admin: a notice with a way to try again.
 *
 * Its button belongs at the top right of its card, beside the title, so it is
 * drawn into `actionsSlot`, the place the card's header keeps for it (`null`
 * until the header has mounted). With no slot at all, as when the panel is
 * drawn on its own, it stays above the list.
 */
export function TemplatesPanel({
  actionsSlot,
}: {
  actionsSlot?: HTMLElement | null;
} = {}) {
  const t = useTranslations("dashboard.messages.whatsapp");
  const router = useRouter();
  const locale = useDashboardLocale();
  const showError = useActionToast();
  // Redrawn every minute, so "3 min ago" stays true.
  const now = useNow();

  const [{ templates, configured, loading, failed }, dispatch] = useReducer(
    listReducer,
    // Until the first answer, assume the server is set up: the draft warning
    // must not flash on a page that is about to say otherwise.
    { templates: [], configured: true, loading: true, failed: false },
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
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
  // a moment later, not in the effect itself, and not at all if the card was
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

  // The button, and under it, small and muted, when the copy was last brought
  // from Meta (it brings itself): one column, the line CENTRED on the button's
  // axis, wherever the column is drawn.
  const actions = (
    <div className="flex flex-col items-center gap-1 whitespace-nowrap">
      <Button className="gap-2" href={newWhatsAppTemplateHref()}>
        <IconPlus />
        {t("new")}
      </Button>
      {configured &&
        (syncing ? (
          <p role="status" className="text-petroleum-400 text-xs">
            {t("autoSync.updating")}
          </p>
        ) : (
          lastSync !== null && <SyncStamp at={lastSync} now={now} />
        ))}
    </div>
  );

  return (
    <div>
      {actionsSlot && createPortal(actions, actionsSlot)}
      {/* In a card, the description lives in the card's own header, beside the
          button's column; only on its own does the panel draw both. */}
      {actionsSlot === undefined && (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-petroleum-400 max-w-full text-sm">
              {t("intro")}
            </p>
          </div>
          <div className="flex max-w-full flex-wrap gap-3">{actions}</div>
        </div>
      )}

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
          onUseAnotherName={(template) =>
            router.push(newWhatsAppTemplateHref(template.id))
          }
        />
      )}
    </div>
  );
}
