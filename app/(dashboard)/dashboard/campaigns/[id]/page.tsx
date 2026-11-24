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
  HeaderSkeleton,
  TableSkeleton,
} from "@/components/dashboard/skeletons";
import {
  activateCampaign,
  cancelCampaign,
  deleteCampaign,
  duplicateCampaign,
  fetchCampaign,
  pauseCampaign,
  retryFailedRecipients,
} from "@/actions/campaigns";
import { useSendNoticeToast } from "../send-notice-toast";
import { isAutomatedKind } from "@/types/campaign";
import type { CampaignRecipientRow, CampaignRow } from "@/types/campaign";
import { CampaignStatusBadge, RecipientStatusBadge } from "../status-badge";
import { rate, sentCount } from "../campaign-table";
import { triggerEventKey } from "@/lib/campaigns/whatsapp-form";
import { ChannelChip } from "../channel-chip";
import { useAppointmentTrigger } from "../kind-line";
import {
  describeLastError,
  reportTiles,
  sentCountOf,
  statusBreakdown,
  variantBreakdown,
  type ReportTile,
} from "@/lib/campaigns/report";
import { RecipientTable } from "./recipient-table";
import { refusalText as sayRefusal } from "../_form/form-actions";
import { LoadFailed } from "@/components/dashboard/load-failed";

type State =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "missing" }
  | {
      kind: "ready";
      campaign: CampaignRow;
      recipients: CampaignRecipientRow[];
      refreshing: boolean;
    };

type Action =
  | { type: "missing" }
  | { type: "failed" }
  | {
      type: "loaded";
      campaign: CampaignRow;
      recipients: CampaignRecipientRow[];
    }
  | { type: "refreshing" }
  | { type: "loading" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "missing":
      return { kind: "missing" };
    // A read that threw is not "not found". While the page is open and
    // following a send, a hiccup of the poll leaves what is on screen alone.
    case "failed":
      return state.kind === "ready" ? state : { kind: "failed" };
    case "loaded":
      return {
        kind: "ready",
        campaign: action.campaign,
        recipients: action.recipients,
        refreshing: false,
      };
    case "refreshing":
      return state.kind === "ready" ? { ...state, refreshing: true } : state;
    case "loading":
      return { kind: "loading" };
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
  const appointmentTrigger = useAppointmentTrigger();
  const tToasts = useTranslations("dashboard.toasts");
  const notifySend = useSendNoticeToast();
  const locale = useDashboardLocale();
  const { id } = useParams<{ id: string }>();
  const { push, replace } = useRouter();
  const [state, dispatch] = useReducer(reducer, { kind: "loading" });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useDynamicBreadcrumb(state.kind === "ready" ? state.campaign.name : null);

  const load = useCallback(async () => {
    const result = await fetchCampaign(getAccessToken(), id).catch(() => null);
    if (result === null) {
      dispatch({ type: "failed" });
      return;
    }
    const { campaign, recipients } = result;
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
  /** A refusal in words; a template that cannot go out says in which language. */
  const refusalText = (failure: { error?: string; locale?: unknown }) =>
    sayRefusal(t, failure);

  async function act<R extends { ok: boolean; error?: string }>(
    name: string,
    action: () => Promise<R>,
    onOk: (result: R) => void,
  ) {
    setBusy(name);
    try {
      const result = await action();
      if (result.ok) onOk(result);
      else toast.error(refusalText(result));
    } catch {
      // A request that threw (the network, a gateway that gave up on a long
      // retry) must not leave the button as it was with nothing said.
      toast.error(errorText("generic"));
    } finally {
      setBusy(null);
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="px-6 py-8 lg:px-10">
        <HeaderSkeleton buttons={2} />
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="border-sand-200 rounded-2xl border bg-white p-4"
            >
              <div className="bg-sand-100 h-3 w-16 animate-pulse rounded" />
              <div className="bg-sand-100 mt-2 h-7 w-10 animate-pulse rounded-lg" />
            </div>
          ))}
        </div>
        <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
          <TableSkeleton cols={5} />
        </div>
      </div>
    );
  }
  if (state.kind === "failed") {
    return (
      <LoadFailed
        onRetry={() => {
          dispatch({ type: "loading" });
          void load();
        }}
      />
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
  const whatsapp = campaign.channel === "whatsapp";
  // `recipients_count` also counts the rows a long WhatsApp send has not
  // reached yet, so there the rows themselves say how many went out.
  const sent = whatsapp ? sentCountOf(recipients) : sentCount(campaign);
  const lastError = describeLastError(
    campaign.last_error,
    campaign.channel,
    campaign.status,
  );
  const byLanguage = (["en", "es"] as const).map((lang) => {
    const rows = recipients.filter((r) => r.language === lang);
    const delivered = rows.filter((r) =>
      ["delivered", "opened", "clicked"].includes(r.status),
    ).length;
    return { lang, total: rows.length, delivered };
  });

  const counters: Record<ReportTile, number> = {
    sent,
    delivered: campaign.delivered_count,
    opened: campaign.opened_count,
    clicked: campaign.clicked_count,
    bounced: campaign.bounced_count,
    complained: campaign.complained_count,
    failed: campaign.failed_count,
  };
  // On WhatsApp "opened" is the read receipt and "bounced" a delivery Meta
  // said failed; the counters are the same columns, the words are not.
  const tileLabel = (key: ReportTile) =>
    whatsapp && key === "opened"
      ? t("detail.read")
      : whatsapp && key === "bounced"
        ? t("detail.undelivered")
        : t(`detail.${key}`);
  const tiles = reportTiles(campaign.channel).map((key) => ({
    key,
    value: counters[key],
  }));

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
            <ChannelChip channel={campaign.channel} />
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
                  // An appointment notice says its own when: "48 h before".
                  appointmentTrigger(campaign.trigger) ??
                    t(
                      `trigger.event.${triggerEventKey(campaign.trigger.event, campaign.channel)}`,
                    ),
                  campaign.trigger.event === "after_booking"
                    ? `${campaign.trigger.days ?? 0} ${t("trigger.daysAfter")}`
                    : campaign.trigger.event === "first_visit"
                      ? t("trigger.hoursAfterFirstVisit", {
                          hours: campaign.trigger.hours ?? 0,
                        })
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
          {lastError && (
            <p className="text-xs text-red-500">
              {lastError.kind === "raw"
                ? t("detail.lastError", { error: lastError.text })
                : t(`detail.notes.${lastError.key}`, lastError.values)}
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
                  (result) => {
                    // Not "retried" when the retry stopped half way.
                    if (result.ok) notifySend(result, "campaignRetried");
                    void load();
                  },
                )
              }
            >
              {busy === "retry"
                ? t("detail.retrying")
                : t("detail.retryFailed")}
            </Button>
          )}
          {whatsapp &&
            campaign.status === "sent" &&
            campaign.failed_count > 0 && (
              <p className="text-petroleum-400 basis-full text-xs">
                {t("detail.retryWhatsAppNote")}
              </p>
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

      <div
        className={`grid grid-cols-2 gap-3 md:grid-cols-4 ${
          whatsapp ? "lg:grid-cols-5" : "lg:grid-cols-7"
        }`}
      >
        {tiles.map(({ key, value }) => (
          <div
            key={key}
            className="border-sand-200 rounded-2xl border bg-white p-4"
          >
            <p className="text-petroleum-400 text-xs">{tileLabel(key)}</p>
            <p className="font-display text-petroleum-700 mt-1 text-2xl">
              {value}
            </p>
            {key !== "sent" && (
              <p className="text-petroleum-400 text-xs">{rate(value, sent)}</p>
            )}
          </div>
        ))}
      </div>
      <p className="text-petroleum-400 -mt-3 text-xs">
        {whatsapp ? t("detail.readNote") : t("detail.openNote")}
      </p>

      {whatsapp && (
        <section className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-3 text-sm font-semibold">
            {t("detail.byStatus")}
          </h2>
          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            {statusBreakdown(recipients).map(({ status, count }) => (
              <li key={status} className="flex items-center gap-2">
                <RecipientStatusBadge status={status} channel="whatsapp" />
                <span className="text-petroleum-700 text-lg font-medium tabular-nums">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* On both channels: each recipient was written to in her language,
          with the email, or the WhatsApp template, of that language. */}
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
          {/* Each variant has a subject per language the campaign is written
              in, and every recipient was dealt one of hers: the numbers are
              per variant AND per language. */}
          <div className="grid grid-cols-2 gap-4">
            {variantBreakdown(campaign, recipients).map(
              ({ variant, languages }) => (
                <div key={variant} className="flex flex-col gap-3">
                  <p className="text-petroleum-400 text-xs uppercase">
                    {variant}
                  </p>
                  {languages.map((line) => (
                    <div key={line.locale}>
                      <p className="text-petroleum-700 truncate text-sm font-medium">
                        {languages.length > 1 && (
                          <span className="text-petroleum-400 mr-2 text-xs uppercase">
                            {line.locale}
                          </span>
                        )}
                        {line.subject ?? "—"}
                      </p>
                      <p className="text-petroleum-500 mt-1 text-sm">
                        {line.total} · {t("detail.opened").toLowerCase()}{" "}
                        {rate(line.opened, line.total)} ·{" "}
                        {t("detail.clicked").toLowerCase()}{" "}
                        {rate(line.clicked, line.total)}
                      </p>
                    </div>
                  ))}
                </div>
              ),
            )}
          </div>
        </section>
      )}

      <RecipientTable
        recipients={recipients}
        locale={locale}
        channel={campaign.channel}
        kind={campaign.kind}
      />
    </div>
  );
}
