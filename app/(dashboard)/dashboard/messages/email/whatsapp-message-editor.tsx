"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import { TemplatePreview } from "@/components/dashboard/template-preview";
import { WhatsAppParamRow } from "@/components/dashboard/whatsapp-param-mapper";
import {
  saveMessageTemplate,
  sendTestMessage,
} from "@/actions/message-templates";
import { useMessageDraft } from "@/hooks/use-message-draft";
import { headerActions } from "@/lib/messages/header-actions";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { NEW_APPOINTMENT_NOTICE_HREF } from "@/lib/campaigns/new-start";
import {
  draftKey,
  validateWhatsAppDraft,
  whatsappDraftOffer,
  type WhatsAppDraft,
} from "@/lib/messages/draft";
import { useFieldError } from "@/hooks/use-field-error";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { fitParams, sampleParams } from "@/lib/campaigns/whatsapp-form";
import type { MessageKey } from "@/lib/messages/catalog";
import type { MessageTemplateRowView } from "@/lib/messages/types";
import {
  messageParamFields,
  messageTemplateChoices,
  whatsappRowState,
  type SavedWhatsAppRow,
} from "@/lib/messages/whatsapp-row";
import type {
  WhatsAppParamSource,
  WhatsAppTemplateRow,
} from "@/lib/whatsapp/types";
import { useEmailActionToast } from "./action-error";
import {
  DraftBanner,
  MessagePageHeader,
  ResetButton,
  ResetConfirm,
  UnsavedBar,
  useMessageReset,
} from "./page-parts";

type Locale = "es" | "en";

/**
 * Sets up the WhatsApp notice of one message in one language: which approved
 * template goes out and where each of its values comes from, with the bubble,
 * a test to the admin's own phone, and what the sender does and does not do.
 *
 * The server judges the save (the template must exist, be approved and in the
 * language, with exactly the parameters it declares); the list offered here is
 * the same rule, so what is chosen from it is accepted.
 */
export function WhatsAppMessageEditor({
  messageKey,
  locale,
  saved,
  templates,
  canTest,
}: {
  messageKey: MessageKey;
  locale: Locale;
  saved: MessageTemplateRowView | null;
  templates: WhatsAppTemplateRow[];
  /** False when the server has no WhatsApp account to send through. */
  canTest: boolean;
}) {
  const t = useTranslations("dashboard.messages.email.whatsapp");
  const tEd = useTranslations("dashboard.messages.email.whatsapp.editor");
  const tEmail = useTranslations("dashboard.messages.email");
  const tKeys = useTranslations("dashboard.messages.keys");
  const tFields = useTranslations("dashboard.campaigns.form.whatsapp");
  const fieldError = useFieldError();
  const showError = useEmailActionToast();

  // What counts as saved: what the page opened with, then what was last saved
  // here. The page stays open after a save, so this moves.
  const [baseline, setBaseline] = useState({
    templateId: saved?.whatsapp_template_id ?? null,
    params: saved?.whatsapp_params ?? [],
  });
  const [hasSaved, setHasSaved] = useState(saved !== null);
  const [templateId, setTemplateId] = useState<string | null>(
    baseline.templateId,
  );
  const [params, setParams] = useState<WhatsAppParamSource[]>(baseline.params);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const inFlight = useRef(false);
  // A date that does not move while the admin is typing.
  const [today] = useState(() => new Date());

  const fields = messageParamFields(messageKey);
  const choices = messageTemplateChoices(templates, locale);
  const selected = templates.find((tpl) => tpl.id === templateId) ?? null;
  const stale = hasSaved
    ? whatsappRowState(
        {
          enabled: true,
          whatsapp_template_id: templateId,
          whatsapp_params: params,
        } as SavedWhatsAppRow,
        templates,
        locale,
      )
    : null;
  // The selected one is shown and mapped only while it is still a valid choice.
  const usable =
    selected && choices.eligible.some((tpl) => tpl.id === selected.id)
      ? selected
      : null;

  const dirty =
    templateId !== baseline.templateId ||
    JSON.stringify(params) !== JSON.stringify(baseline.params);
  const guard = useUnsavedGuard(dirty);
  const currentDraft = useMemo<WhatsAppDraft>(
    () => ({ templateId, params }),
    [templateId, params],
  );
  const draft = useMessageDraft<WhatsAppDraft>({
    kind: "whatsapp",
    storageKey: draftKey("whatsapp", messageKey, locale),
    validate: validateWhatsAppDraft,
    offerOf: (stored) => whatsappDraftOffer(stored, baseline),
    current: currentDraft,
    dirty,
  });

  const reset = useMessageReset({
    channel: "whatsapp",
    messageKey,
    locale,
    onBeforeLeave: draft.forget,
  });
  const actions = headerActions({
    channel: "whatsapp",
    dirty,
    saving,
    testing,
    switching: false,
    hasSaved,
    enabled: true,
    canTest,
    hasTemplate: baseline.templateId !== null,
    usable: usable !== null,
  });
  const resetLabels = {
    button: t("actions.remove"),
    working: t("actions.removing"),
    confirm: t("removeConfirm"),
    yes: t("removeYes"),
    no: t("removeNo"),
  };

  function recoverDraft() {
    const recovered = draft.take();
    if (!recovered) return;
    setTemplateId(recovered.templateId);
    setParams(recovered.params);
    setErrors({});
  }
  const language = tEmail(`locales.${locale}`);

  function pick(id: string) {
    const tpl = templates.find((c) => c.id === id);
    if (!tpl) return;
    setTemplateId(tpl.id);
    setParams((before) => fitParams(before, tpl.param_count));
    setErrors({});
  }

  function setParam(index: number, source: WhatsAppParamSource) {
    setParams((before) => before.map((p, i) => (i === index ? source : p)));
    setErrors({});
  }

  async function save() {
    if (!dirty || !templateId || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      const result = await saveMessageTemplate(getAccessToken(), {
        key: messageKey,
        channel: "whatsapp",
        locale,
        whatsappTemplateId: templateId,
        whatsappParams: params,
      });
      if (result.ok) {
        notifySuccess(tEd("saved"));
        // Still here, and now saved.
        setBaseline({ templateId, params });
        setHasSaved(true);
        setErrors({});
        inFlight.current = false;
        setSaving(false);
        return;
      }
      setErrors(result.fieldErrors ?? {});
      showError(result);
    } catch {
      showError({ error: "generic" });
    }
    inFlight.current = false;
    setSaving(false);
  }

  async function sendTest() {
    if (inFlight.current || dirty) return;
    inFlight.current = true;
    setTesting(true);
    try {
      const result = await sendTestMessage(
        getAccessToken(),
        messageKey,
        "whatsapp",
        locale,
      );
      if (result.ok) notifySuccess(tEd("testSent", { phone: result.to }));
      else showError(result);
    } catch {
      showError({ error: "generic" });
    } finally {
      inFlight.current = false;
      setTesting(false);
    }
  }

  const options: SelectOption<string>[] = choices.eligible.map((tpl) => ({
    value: tpl.id,
    label: tpl.name,
    desc: tpl.body.length > 90 ? `${tpl.body.slice(0, 90)}…` : tpl.body,
  }));
  const excludedLines = [
    ...Object.entries(choices.excluded).map(
      ([issue, count]) => [issue, count ?? 0] as const,
    ),
    ...(choices.dynamicUrl > 0
      ? ([["dynamic_url", choices.dynamicUrl]] as const)
      : []),
  ].filter(([, count]) => count > 0);
  const templateError = fieldError(errors.whatsappTemplateId);
  const paramsError = fieldError(errors.whatsappParams);

  return (
    <div className="flex flex-col gap-6">
      <MessagePageHeader
        title={tEd("title", { name: tKeys(messageKey), language })}
        status={{
          text: hasSaved ? t("pageStatus.set") : t("pageStatus.none"),
          tone: hasSaved ? "custom" : "default",
        }}
        help={{
          id: "message-test-help",
          text:
            actions.help === "saveFirst" ? tEd("saveFirst") : tEd("testNote"),
        }}
        actions={
          <>
            {actions.reset.shown && (
              <ResetButton
                label={reset.busy ? resetLabels.working : resetLabels.button}
                disabled={actions.reset.disabled || reset.busy}
                onClick={() => reset.setAsking(true)}
              />
            )}
            <Button
              variant="outline"
              aria-describedby="message-test-help"
              disabled={actions.test.disabled}
              onClick={() => void sendTest()}
            >
              {testing ? tEd("testing") : tEd("test")}
            </Button>
            <Button
              disabled={actions.save.disabled}
              onClick={() => void save()}
              title={dirty ? undefined : tEd("unchanged")}
            >
              {saving ? tEd("saving") : tEd("save")}
            </Button>
          </>
        }
      />

      {reset.asking && (
        <ResetConfirm
          labels={resetLabels}
          busy={reset.busy}
          onCancel={() => reset.setAsking(false)}
          onConfirm={() => void reset.reset()}
        />
      )}

      {guard.pending && (
        <UnsavedBar onStay={guard.stay} onLeave={guard.leave} />
      )}

      {draft.offered && (
        <DraftBanner onRecover={recoverDraft} onDiscard={draft.discard} />
      )}

      {/* When it goes out, as the subtitle; the rules, as a list one can read. */}
      <p className="text-petroleum-700 max-w-prose text-sm font-medium">
        {t(`when.${messageKey}`)}
      </p>

      <ul className="bg-sand-50 text-petroleum-500 flex max-w-prose list-disc flex-col gap-2 rounded-xl py-3 pr-4 pl-8 text-xs">
        <li>{t("rules.consent")}</li>
        <li>{t("rules.nothing")}</li>
        <li>{t("rules.languages")}</li>
        <li>{t("rules.stop")}</li>
        <li>{t("rules.noButtons")}</li>
      </ul>

      {/* The reminder and what follows an appointment are set up as a campaign. */}
      <p className="text-petroleum-400 max-w-prose text-xs">
        {t("campaignNote")}{" "}
        <Link
          href={NEW_APPOINTMENT_NOTICE_HREF}
          className="text-petroleum-700 font-medium underline underline-offset-2"
        >
          {t("campaignLink")}
        </Link>
      </p>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="wa-message-template"
          className="text-petroleum-500 text-xs font-medium"
        >
          {tEd("template")}
        </label>
        {options.length > 0 ? (
          <OptionSelect
            id="wa-message-template"
            value={usable?.id ?? ""}
            options={options}
            placeholder={tEd("templatePlaceholder")}
            disabled={saving}
            onChange={pick}
          />
        ) : (
          <div className="bg-sand-50 rounded-xl px-4 py-4">
            <p className="text-petroleum-700 text-sm font-medium">
              {tEd("noneTitle", { language })}
            </p>
            <Link
              href="/dashboard/messages?tab=whatsapp"
              className="text-petroleum-700 mt-2 inline-block text-sm font-medium underline underline-offset-2"
            >
              {tEd("create")}
            </Link>
          </div>
        )}
        {templateError && (
          <p role="alert" className="text-xs text-red-600">
            {templateError}
          </p>
        )}
        {stale && stale.kind === "invalid" && !usable && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700"
          >
            {tEd("templateStale", { reason: t(`issue.${stale.issue}`) })}
          </p>
        )}
        {excludedLines.length > 0 && (
          <div className="text-petroleum-400 text-xs">
            <p className="font-medium">{tEd("excludedTitle")}</p>
            <ul className="mt-1 list-disc pl-4">
              {excludedLines.map(([issue, count]) => (
                <li key={issue}>{tEd(`excluded.${issue}`, { count })}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {usable && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
          <section aria-labelledby="wa-message-params">
            <h2
              id="wa-message-params"
              className="text-petroleum-500 mb-1 text-sm font-semibold"
            >
              {tFields("paramsTitle")}
            </h2>
            <p className="text-petroleum-400 mb-4 text-xs">
              {tFields("paramsHint", { count: usable.param_count })}
            </p>
            {paramsError && (
              <p role="alert" className="mb-3 text-xs text-red-600">
                {paramsError}
              </p>
            )}
            <div className="flex flex-col gap-5">
              {fitParams(params, usable.param_count).map((source, index) => (
                <WhatsAppParamRow
                  key={index}
                  index={index}
                  idPrefix="wa-message-param"
                  source={source}
                  example={usable.example_params?.[index]}
                  fields={fields}
                  available={
                    source.kind !== "field" || fields.includes(source.field)
                  }
                  unavailableText={tEd("paramUnavailable")}
                  error={fieldError(errors[`whatsappParams.${index}`])}
                  disabled={saving}
                  onChange={(next) => setParam(index, next)}
                />
              ))}
            </div>
          </section>
          <aside>
            <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
              {tEd("preview")}
            </h2>
            <p className="text-petroleum-400 mb-3 text-xs">
              {tEd("previewNote")}
            </p>
            <TemplatePreview
              headerText={usable.header_text}
              body={usable.body}
              footerText={usable.footer_text}
              buttons={usable.buttons ?? []}
              examples={sampleParams(
                fitParams(params, usable.param_count),
                locale,
                "automated",
                { event: "after_booking" },
                today,
              )}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
