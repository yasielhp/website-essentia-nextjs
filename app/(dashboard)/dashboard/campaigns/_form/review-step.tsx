"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";
import { bookableServices } from "@/data/services-data";
import { LocaleTabs } from "@/components/dashboard/locale-tabs";
import { requiredLocales } from "@/lib/schemas";
import { whatsappBlocks } from "@/lib/campaigns/whatsapp-content";
import {
  WHATSAPP_MESSAGES_PER_RUN,
  sampleParams,
  triggerEventKey,
} from "@/lib/campaigns/whatsapp-form";
import {
  isAutomatedKind,
  type CampaignAudience,
  type CampaignLocale,
} from "@/types/campaign";
import { TemplatePreview } from "@/components/dashboard/template-preview";
import { useAppointmentTrigger } from "../kind-line";
import type { FormState } from "./form-state";
import type { TemplatesState } from "./use-whatsapp-templates";

const META_PRICING_URL =
  "https://developers.facebook.com/docs/whatsapp/pricing";

/** The conditions as sentences, so the admin reads what they built. */
export function describeAudience(
  audience: CampaignAudience,
  t: ReturnType<typeof useTranslations<"dashboard.campaigns.review">>,
  tAudience: ReturnType<typeof useTranslations<"dashboard.campaigns.audience">>,
): string[] {
  const lines: string[] = [];
  // A hand-made list is its people; the conditions were only how they were found.
  if (audience.manualOnly) {
    return [t("condManualList", { count: audience.manualIds.length })];
  }
  if (audience.language !== "any") {
    lines.push(
      t("condLanguage", {
        value:
          audience.language === "es"
            ? tAudience("languageEs")
            : tAudience("languageEn"),
      }),
    );
  }
  if (audience.newsletter === true) lines.push(t("condNewsletter"));
  if (audience.neverBooked) lines.push(t("condNeverBooked"));
  if (audience.hasBooked) lines.push(t("condHasBooked"));
  if (audience.services.length > 0) {
    const titles = audience.services.map(
      (id) => bookableServices.find((s) => s.id === id)?.title ?? id,
    );
    lines.push(t("condServices", { value: titles.join(", ") }));
  }
  if (audience.lastBooking) {
    lines.push(
      t(
        audience.lastBooking.op === "gt"
          ? "condLastBookingGt"
          : "condLastBookingLt",
        { days: audience.lastBooking.days },
      ),
    );
  }
  if (audience.manualIds.length > 0) {
    lines.push(t("condManual", { count: audience.manualIds.length }));
  }
  return lines;
}

/** `datetime-local` wants local time without a zone; five minutes from now. */
function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 5 * 60_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The last look before anything leaves, and the four ways out: a test to
 * oneself, a saved draft, a scheduled send, or the send itself. The last one
 * asks twice, with the number of people in the question.
 */
export function ReviewStep({
  state,
  templates,
  onLocale,
  onTest,
  onSchedule,
  onSendNow,
  onActivate,
}: {
  state: FormState;
  /** The account's templates; only a WhatsApp campaign has one to show. */
  templates: TemplatesState;
  /** Puts another of the campaign's languages on screen. */
  onLocale: (locale: CampaignLocale) => void;
  /** Sends the version on screen to the admin. */
  onTest: () => Promise<void>;
  onSchedule: (iso: string) => Promise<void>;
  onSendNow: () => Promise<void>;
  /** Automated kinds: switch the campaign on instead of sending it. */
  onActivate: () => Promise<void>;
}) {
  const t = useTranslations("dashboard.campaigns.review");
  const tAudience = useTranslations("dashboard.campaigns.audience");
  const tContent = useTranslations("dashboard.campaigns.content");
  const tTrigger = useTranslations("dashboard.campaigns.trigger");
  const tType = useTranslations("dashboard.campaigns.type");
  const appointmentTrigger = useAppointmentTrigger();
  const { audience, content, reach, submitting, error, kind, trigger } = state;
  const whatsapp = state.channel === "whatsapp";
  const tWhatsApp = useTranslations("dashboard.campaigns.form.whatsapp");
  const [today] = useState(() => new Date());
  const [busy, setBusy] = useState<
    "test" | "schedule" | "send" | "activate" | null
  >(null);
  // The campaign is written in each of these (the email, or a WhatsApp
  // template apiece); the one on screen is the one the summary shows and the
  // test sends.
  const locales = requiredLocales(audience);
  const locale = state.activeLocale;
  const localeLabel = (value: CampaignLocale) =>
    value === "es" ? tContent("localeEs") : tContent("localeEn");
  const whatsappBlock = whatsapp
    ? whatsappBlocks(content.whatsapp, audience)[locale]
    : null;
  const chosenTemplate =
    whatsapp && templates.status === "ready"
      ? (templates.templates.find(
          (tpl) => tpl.id === whatsappBlock?.templateId,
        ) ?? null)
      : null;
  const languageSwitch = (
    <LocaleTabs
      id="campaign-review-language"
      label={tContent("language")}
      locales={locales}
      active={locale}
      onChange={onLocale}
      nameOf={localeLabel}
      disabled={submitting || busy !== null}
    />
  );
  const automated = isAutomatedKind(kind);
  const [confirming, setConfirming] = useState(false);
  // Activating starts messaging people on its own: it asks, like "Send now".
  const [confirmingActivate, setConfirmingActivate] = useState(false);
  const [scheduleAt, setScheduleAt] = useState(defaultScheduleValue);

  const conditions = describeAudience(audience, t, tAudience);
  const count = reach?.count ?? 0;
  const disabled = submitting || busy !== null;

  const run = async (
    kind: NonNullable<typeof busy>,
    action: () => Promise<void>,
  ) => {
    setBusy(kind);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-3 text-sm font-semibold">
            {t("audienceSummary")}
          </h2>
          <p className="font-display text-petroleum-700 text-3xl">{count}</p>
          {reach && (
            <p className="text-petroleum-400 mt-0.5 text-xs">
              {tAudience("reachByLanguage", { en: reach.en, es: reach.es })}
            </p>
          )}
          <h3 className="text-petroleum-400 mt-4 mb-1 text-xs font-medium">
            {t("conditions")}
          </h3>
          {conditions.length === 0 ? (
            <p className="text-petroleum-500 text-sm">
              {kind === "appointment"
                ? t("noConditionsAppointment")
                : whatsapp
                  ? t("noConditionsWhatsApp")
                  : t("noConditions")}
            </p>
          ) : (
            <ul className="text-petroleum-500 list-disc pl-4 text-sm">
              {conditions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-3 text-sm font-semibold">
            {t("contentSummary")}
          </h2>
          {whatsapp ? (
            <div className="flex flex-col gap-3">
              {languageSwitch}
              {chosenTemplate ? (
                <>
                  <p className="text-petroleum-700 text-sm font-medium">
                    {t("whatsappTemplate", { name: chosenTemplate.name })}
                  </p>
                  <TemplatePreview
                    headerText={chosenTemplate.header_text}
                    body={chosenTemplate.body}
                    footerText={chosenTemplate.footer_text}
                    buttons={chosenTemplate.buttons ?? []}
                    examples={sampleParams(
                      whatsappBlock?.params ?? [],
                      locale,
                      kind,
                      trigger,
                      today,
                    )}
                  />
                  <p className="text-petroleum-400 text-xs">
                    {tWhatsApp("previewNote")}
                  </p>
                </>
              ) : templates.status === "ready" ? (
                <p className="text-sm text-red-600">
                  {t("whatsappNoTemplate")}
                </p>
              ) : (
                <div className="bg-sand-100 h-24 animate-pulse rounded-xl" />
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {languageSwitch}
              <dl>
                <dt className="text-petroleum-400 text-xs font-medium">
                  {localeLabel(locale)}
                </dt>
                <dd className="text-petroleum-700 text-sm font-medium">
                  {kind === "split" ? "A · " : ""}
                  {content[locale].subject}
                </dd>
                {kind === "split" && (
                  <dd className="text-petroleum-700 text-sm font-medium">
                    B · {content[locale].subjectB}
                  </dd>
                )}
                <dd className="text-petroleum-500 text-sm">
                  {content[locale].title}
                </dd>
              </dl>
            </div>
          )}
        </section>
      </div>

      {error && (
        <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {count === 0 && (
        <p className="rounded-xl bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          {kind === "appointment" ? t("emptyAppointment") : t("emptyAudience")}
        </p>
      )}

      <section className="border-sand-200 flex flex-col gap-4 rounded-2xl border bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="md"
            disabled={disabled}
            onClick={() => void run("test", onTest)}
          >
            {busy === "test" ? t("sendingTest") : t("sendTest")}
          </Button>
          <div className="flex flex-col gap-0.5">
            {whatsapp && (
              <p className="text-petroleum-400 text-xs">
                {t("whatsappTestHint")}
              </p>
            )}
            {locales.length > 1 && (
              <p className="text-petroleum-400 text-xs">
                {t("testLanguage", { language: localeLabel(locale) })}
              </p>
            )}
          </div>
        </div>

        {whatsapp && (
          <div className="bg-sand-50 text-petroleum-500 flex flex-col gap-1 rounded-xl px-4 py-3 text-xs">
            <p>
              {t("whatsappCost")}{" "}
              <a
                href={META_PRICING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-petroleum-700 font-medium underline underline-offset-2"
              >
                {t("whatsappCostLink")}
              </a>
            </p>
            <p>
              {kind === "appointment"
                ? t("appointmentPace")
                : t("whatsappPace", { count: WHATSAPP_MESSAGES_PER_RUN })}
            </p>
          </div>
        )}

        {automated ? (
          <div className="border-sand-100 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-petroleum-700 text-sm font-medium">
                {tType(kind)} ·{" "}
                {appointmentTrigger(trigger) ??
                  (trigger.event
                    ? tTrigger(
                        `event.${triggerEventKey(trigger.event, state.channel)}`,
                      )
                    : "")}
                {trigger.event === "after_booking"
                  ? ` (${trigger.days ?? 0} ${tTrigger("daysAfter")})`
                  : trigger.event === "first_visit"
                    ? ` (${tTrigger("hoursAfterFirstVisit", { hours: trigger.hours ?? 0 })})`
                    : ""}
              </p>
              <p className="text-petroleum-400 text-xs">{t("activateHint")}</p>
              {kind === "appointment" && (
                <p className="text-petroleum-400 text-xs">
                  {tTrigger("appointment.rules")}
                </p>
              )}
              {whatsapp && trigger.event === "newsletter_subscribed" && (
                <>
                  <p className="text-petroleum-400 text-xs">
                    {tTrigger("eventDesc.newsletter_subscribedWhatsApp")}
                  </p>
                  <p className="text-petroleum-400 text-xs">
                    {t("whatsappConsentNote")}
                  </p>
                </>
              )}
            </div>
            {confirmingActivate ? (
              <div className="bg-petroleum-50 flex flex-col gap-3 rounded-xl p-4 sm:max-w-sm">
                <p
                  role="alertdialog"
                  aria-label={t("confirmActivate")}
                  className="text-petroleum-700 text-sm font-medium"
                >
                  {t("confirmActivate")}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="md"
                    disabled={disabled}
                    onClick={() => setConfirmingActivate(false)}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    size="md"
                    disabled={disabled}
                    onClick={() =>
                      void run("activate", async () => {
                        await onActivate();
                        setConfirmingActivate(false);
                      })
                    }
                  >
                    {busy === "activate"
                      ? t("activating")
                      : t("confirmActivateYes")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="md"
                disabled={disabled}
                onClick={() => setConfirmingActivate(true)}
              >
                {t("activate")}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="border-sand-100 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-petroleum-500 text-xs font-medium">
                  {t("scheduleAt")}
                </span>
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  min={defaultScheduleValue()}
                  disabled={disabled}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
              <Button
                variant="soft"
                size="md"
                disabled={disabled || count === 0 || !scheduleAt}
                onClick={() =>
                  void run("schedule", () =>
                    onSchedule(new Date(scheduleAt).toISOString()),
                  )
                }
              >
                {busy === "schedule" ? t("scheduling") : t("schedule")}
              </Button>
            </div>

            <div className="border-sand-100 border-t pt-4">
              {confirming ? (
                <div className="bg-petroleum-50 flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-petroleum-700 text-sm font-medium">
                    {t("confirmSend", { count })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="md"
                      disabled={disabled}
                      onClick={() => setConfirming(false)}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      size="md"
                      disabled={disabled}
                      onClick={() =>
                        void run("send", async () => {
                          await onSendNow();
                          setConfirming(false);
                        })
                      }
                    >
                      {busy === "send" ? t("sending") : t("confirm")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="md"
                  disabled={disabled || count === 0}
                  onClick={() => setConfirming(true)}
                >
                  {t("sendNow")}
                </Button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
