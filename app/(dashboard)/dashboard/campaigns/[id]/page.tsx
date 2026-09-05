"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { useDynamicBreadcrumb } from "@/context/breadcrumb-context";
import { formatLongDate } from "@/utils/format";
import { Button } from "@/components/ui/button";
import {
  activateCampaign,
  cancelCampaign,
  deleteCampaign,
  duplicateCampaign,
  fetchCampaign,
  pauseCampaign,
  retryFailedRecipients,
} from "@/actions/campaigns";
import { isAutomatedKind } from "@/types/campaign";
import type { CampaignRecipientRow, CampaignRow } from "@/types/campaign";
import { CampaignStatusBadge } from "../status-badge";
import { rate, sentCount } from "../campaign-table";
import { RecipientTable } from "./recipient-table";

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | {
      kind: "ready";
      campaign: CampaignRow;
      recipients: CampaignRecipientRow[];
      refreshing: boolean;
    };

type Action =
  | { type: "missing" }
  | {
      type: "loaded";
      campaign: CampaignRow;
      recipients: CampaignRecipientRow[];
    }
  | { type: "refreshing" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "missing":
      return { kind: "missing" };
    case "loaded":
      return {
        kind: "ready",
        campaign: action.campaign,
        recipients: action.recipients,
        refreshing: false,
      };
    case "refreshing":
      return state.kind === "ready" ? { ...state, refreshing: true } : state;
  }
}

/** While Resend is still being walked, the numbers move; the page follows. */
const POLL_WHILE_SENDING_MS = 5_000;

/**
 * What happened to a campaign: the counters, the split by language, and one
 * row per person. Actions live up top; the only irreversible one asks first.
 */
export default function CampaignDetailPage() {
  const t = useTranslations("dashboard.campaigns");
  const tToasts = useTranslations("dashboard.toasts");
  const locale = useDashboardLocale();
  const { id } = useParams<{ id: string }>();
  const { push, replace } = useRouter();
  const [state, dispatch] = useReducer(reducer, { kind: "loading" });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useDynamicBreadcrumb(state.kind === "ready" ? state.campaign.name : null);

  const load = useCallback(async () => {
    const { campaign, recipients } = await fetchCampaign(
      getAccessToken(),
      id,
    ).catch(() => ({ campaign: null, recipients: [] }));
    if (!campaign) {
      dispatch({ type: "missing" });
      return;
    }
    dispatch({ type: "loaded", campaign, recipients });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const sending = state.kind === "ready" && state.campaign.status === "sending";
  useEffect(() => {
    if (!sending) return;
    const timer = setInterval(() => {
      dispatch({ type: "refreshing" });
      void load();
    }, POLL_WHILE_SENDING_MS);
    return () => clearInterval(timer);
  }, [sending, load]);

  const errorText = (code: string) =>
    t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic");

  async function act(
    name: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    onOk: () => void,
  ) {
    setBusy(name);
    try {
      const result = await action();
      if (result.ok) onOk();
      else toast.error(errorText(result.error ?? "generic"));
    } finally {
      setBusy(null);
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="px-6 py-8 lg:px-10">
        <div className="bg-sand-100 h-10 w-64 animate-pulse rounded-xl" />
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-sand-100 h-24 animate-pulse rounded-2xl"
            />
          ))}
        </div>
      </div>
    );
  }
  if (state.kind === "missing") {
    return (
      <div className="text-petroleum-400 px-6 py-20 text-center text-sm">
        {t("form.notFound")}
      </div>
    );
  }

  const { campaign, recipients, refreshing } = state;
  const sent = sentCount(campaign);
  const byLanguage = (["en", "es"] as const).map((lang) => {
    const rows = recipients.filter((r) => r.language === lang);
    const delivered = rows.filter((r) =>
      ["delivered", "opened", "clicked"].includes(r.status),
    ).length;
    return { lang, total: rows.length, delivered };
  });

  const tiles: { key: string; value: number }[] = [
    { key: "sent", value: sent },
    { key: "delivered", value: campaign.delivered_count },
    { key: "opened", value: campaign.opened_count },
    { key: "clicked", value: campaign.clicked_count },
    { key: "bounced", value: campaign.bounced_count },
    { key: "complained", value: campaign.complained_count },
    { key: "failed", value: campaign.failed_count },
  ];

  const when = campaign.sent_at
    ? t("detail.sentAt", { date: formatLongDate(campaign.sent_at, locale) })
    : campaign.scheduled_at
      ? t("detail.scheduledFor", {
          date: formatLongDate(campaign.scheduled_at, locale),
        })
      : t("detail.draftSince", {
          date: formatLongDate(campaign.updated_at, locale),
        });

  return (
    <div className="mx-auto flex flex-col gap-6 px-6 py-8 lg:px-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-petroleum-700 text-3xl">
              {campaign.name}
            </h1>
            <CampaignStatusBadge status={campaign.status} />
            {refreshing && (
              <span className="text-petroleum-400 text-xs">
                {t("detail.refreshing")}
              </span>
            )}
          </div>
          <p className="text-petroleum-400 text-sm">
            {isAutomatedKind(campaign.kind) && campaign.trigger.event
              ? [
                  t(`type.${campaign.kind}`),
                  t(`trigger.event.${campaign.trigger.event}`),
                  campaign.trigger.event === "after_booking"
                    ? `${campaign.trigger.days ?? 0} ${t("trigger.daysAfter")}`
                    : null,
                  campaign.last_run_at
                    ? t("detail.lastRun", {
                        date: formatLongDate(campaign.last_run_at, locale),
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : when}
          </p>
          {campaign.last_error && (
            <p className="text-xs text-red-500">
              {t("detail.lastError", { error: campaign.last_error })}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            "draft",
            "scheduled",
            "cancelled",
            "failed",
            "paused",
            "active",
          ].includes(campaign.status) && (
            <Button
              variant="outline"
              size="md"
              href={`/dashboard/campaigns/${campaign.id}/edit`}
            >
              {t("detail.edit")}
            </Button>
          )}
          <Button
            variant="outline"
            size="md"
            disabled={busy !== null}
            onClick={() =>
              void act(
                "duplicate",
                () => duplicateCampaign(getAccessToken(), campaign.id),
                () => {
                  notifySuccess(tToasts("campaignDuplicated"));
                  push("/dashboard/campaigns");
                },
              )
            }
          >
            {t("detail.duplicate")}
          </Button>
          {campaign.status === "active" && (
            <Button
              variant="outline"
              size="md"
              disabled={busy !== null}
              onClick={() =>
                void act(
                  "pause",
                  () => pauseCampaign(getAccessToken(), campaign.id),
                  () => {
                    notifySuccess(tToasts("campaignPaused"));
                    void load();
                  },
                )
              }
            >
              {t("detail.pause")}
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button
              variant="soft"
              size="md"
              disabled={busy !== null}
              onClick={() =>
                void act(
                  "resume",
                  () => activateCampaign(getAccessToken(), campaign.id),
                  () => {
                    notifySuccess(tToasts("campaignActivated"));
                    void load();
                  },
                )
              }
            >
              {t("detail.resume")}
            </Button>
          )}
          {campaign.status === "scheduled" && (
            <Button
              variant="outline"
              size="md"
              disabled={busy !== null}
              onClick={() =>
                void act(
                  "cancel",
                  () => cancelCampaign(getAccessToken(), campaign.id),
                  () => {
                    notifySuccess(tToasts("campaignCancelled"));
                    void load();
                  },
                )
              }
            >
              {t("detail.cancelScheduled")}
            </Button>
          )}
          {campaign.status === "sent" && campaign.failed_count > 0 && (
            <Button
              variant="soft"
              size="md"
              disabled={busy !== null}
              onClick={() =>
                void act(
                  "retry",
                  () => retryFailedRecipients(getAccessToken(), campaign.id),
                  () => {
                    notifySuccess(tToasts("campaignRetried"));
                    void load();
                  },
                )
              }
            >
              {t("detail.retryFailed")}
            </Button>
          )}
          {["draft", "cancelled", "failed", "paused"].includes(
            campaign.status,
          ) &&
            (confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-petroleum-500 text-xs">
                  {t("detail.confirmDelete")}
                </span>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setConfirmingDelete(false)}
                >
                  {t("review.cancel")}
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  disabled={busy !== null}
                  onClick={() =>
                    void act(
                      "delete",
                      () => deleteCampaign(getAccessToken(), campaign.id),
                      () => {
                        notifySuccess(tToasts("campaignDeleted"));
                        replace("/dashboard/campaigns");
                      },
                    )
                  }
                >
                  {t("detail.delete")}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline-danger"
                size="md"
                disabled={busy !== null}
                onClick={() => setConfirmingDelete(true)}
              >
                {t("detail.delete")}
              </Button>
            ))}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {tiles.map(({ key, value }) => (
          <div
            key={key}
            className="border-sand-200 rounded-2xl border bg-white p-4"
          >
            <p className="text-petroleum-400 text-xs">{t(`detail.${key}`)}</p>
            <p className="font-display text-petroleum-700 mt-1 text-2xl">
              {value}
            </p>
            {key !== "sent" && (
              <p className="text-petroleum-400 text-xs">{rate(value, sent)}</p>
            )}
          </div>
        ))}
      </div>
      <p className="text-petroleum-400 -mt-3 text-xs">{t("detail.openNote")}</p>

      <section className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-3 text-sm font-semibold">
          {t("detail.byLanguage")}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {byLanguage.map(({ lang, total, delivered }) => (
            <div key={lang}>
              <p className="text-petroleum-400 text-xs uppercase">{lang}</p>
              <p className="text-petroleum-700 text-lg font-medium">
                {total}
                <span className="text-petroleum-400 ml-2 text-sm">
                  {t("detail.delivered").toLowerCase()} {rate(delivered, total)}
                </span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {campaign.kind === "split" && (
        <section className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-3 text-sm font-semibold">
            {t("detail.variants")}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {(["a", "b"] as const).map((variant) => {
              const rows = recipients.filter((r) => r.variant === variant);
              const opened = rows.filter((r) =>
                ["opened", "clicked"].includes(r.status),
              ).length;
              const clicked = rows.filter((r) => r.status === "clicked").length;
              const block = campaign.content[recipients[0]?.language ?? "es"];
              const subject = variant === "a" ? block.subject : block.subjectB;
              return (
                <div key={variant}>
                  <p className="text-petroleum-400 text-xs uppercase">
                    {variant}
                  </p>
                  <p className="text-petroleum-700 truncate text-sm font-medium">
                    {subject}
                  </p>
                  <p className="text-petroleum-500 mt-1 text-sm">
                    {rows.length} · {t("detail.opened").toLowerCase()}{" "}
                    {rate(opened, rows.length)} ·{" "}
                    {t("detail.clicked").toLowerCase()}{" "}
                    {rate(clicked, rows.length)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <RecipientTable recipients={recipients} locale={locale} />
    </div>
  );
}
