"use client";

import { useRef, useState } from "react";
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
import { useDialogFocus } from "@/hooks/use-dialog-focus";
import { useFieldError } from "@/hooks/use-field-error";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { fitParams, sampleParams } from "@/lib/campaigns/whatsapp-form";
import type { MessageKey } from "@/lib/messages/catalog";
import type { MessageTemplateRowView } from "@/lib/messages/types";
import {
  isFirstReminderSetup,
  messageParamFields,
  messageTemplateChoices,
  whatsappRowState,
  type SavedWhatsAppRow,
} from "@/lib/messages/whatsapp-row";
import type {
  WhatsAppParamSource,
  WhatsAppTemplateRow,
} from "@/lib/whatsapp/types";
import { Modal } from "../whatsapp/modal";
import { useEmailActionToast } from "./action-error";

type Locale = "es" | "en";

/** "Keep editing?" in the footer; focus goes to keeping and back to Close. */
function DiscardBar({
  onKeep,
  onDiscard,
}: {
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("dashboard.messages.email.whatsapp.editor");
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, () => document.getElementById("wa-close-button"));
  return (
    <div
      ref={ref}
      role="alertdialog"
      aria-label={t("discardTitle")}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-petroleum-700 text-sm font-medium">
        {t("discardTitle")}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onKeep}>
          {t("discardNo")}
        </Button>
        <Button variant="danger" onClick={onDiscard}>
          {t("discardYes")}
        </Button>
      </div>
    </div>
  );
}

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
  allRows,
  templates,
  canTest,
  onClose,
  onSaved,
}: {
  messageKey: MessageKey;
  locale: Locale;
  saved: MessageTemplateRowView | null;
  /** Every saved row, to know whether this would be the first reminder. */
  allRows: MessageTemplateRowView[];
  templates: WhatsAppTemplateRow[];
  /** False when the server has no WhatsApp account to send through. */
  canTest: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("dashboard.messages.email.whatsapp");
  const tEd = useTranslations("dashboard.messages.email.whatsapp.editor");
  const tEmail = useTranslations("dashboard.messages.email");
  const tKeys = useTranslations("dashboard.messages.keys");
  const tFields = useTranslations("dashboard.campaigns.form.whatsapp");
  const fieldError = useFieldError();
  const showError = useEmailActionToast();

  const initial = {
    templateId: saved?.whatsapp_template_id ?? null,
    params: saved?.whatsapp_params ?? [],
  };
  const [templateId, setTemplateId] = useState<string | null>(
    initial.templateId,
  );
  const [params, setParams] = useState<WhatsAppParamSource[]>(initial.params);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const inFlight = useRef(false);
  // A date that does not move while the admin is typing.
  const [today] = useState(() => new Date());

  const fields = messageParamFields(messageKey);
  const choices = messageTemplateChoices(templates, locale);
  const selected = templates.find((tpl) => tpl.id === templateId) ?? null;
  const stale = saved
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
    templateId !== initial.templateId ||
    JSON.stringify(params) !== JSON.stringify(initial.params);
  const firstReminder =
    messageKey === "booking_reminder" &&
    isFirstReminderSetup(
      allRows.map((r) => ({
        key: r.key,
        channel: r.channel,
        whatsapp_template_id: r.whatsapp_template_id,
      })),
    );
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

  function requestClose() {
    if (dirty) setConfirmDiscard(true);
    else onClose();
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
        onSaved();
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
    <Modal
      title={tEd("title", { name: tKeys(messageKey), language })}
      onClose={requestClose}
      wide
      dirty={dirty}
      busy={saving}
    >
      <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">
        <div className="bg-sand-50 text-petroleum-500 flex flex-col gap-1.5 rounded-xl px-4 py-3 text-xs">
          <p className="text-petroleum-700 font-medium">
            {t(`when.${messageKey}`)}
          </p>
          <p>{t("rules.consent")}</p>
          <p>{t("rules.nothing")}</p>
          <p>{t("rules.languages")}</p>
          <p>{t("rules.stop")}</p>
          <p>{t("rules.noButtons")}</p>
        </div>

        {firstReminder && (
          <p
            role="note"
            className="rounded-xl bg-yellow-50 px-4 py-3 text-xs text-yellow-800"
          >
            {t("rules.reminderFirst")}
          </p>
        )}

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
                href="/dashboard/messages"
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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <section aria-labelledby="wa-message-params">
              <h3
                id="wa-message-params"
                className="text-petroleum-500 mb-1 text-sm font-semibold"
              >
                {tFields("paramsTitle")}
              </h3>
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
              <h3 className="text-petroleum-500 mb-1 text-sm font-semibold">
                {tEd("preview")}
              </h3>
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

      <div className="border-sand-100 flex shrink-0 flex-col gap-3 border-t px-6 py-4">
        {confirmDiscard ? (
          <DiscardBar
            onKeep={() => setConfirmDiscard(false)}
            onDiscard={onClose}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Button
                variant="outline"
                disabled={
                  saving ||
                  testing ||
                  dirty ||
                  !canTest ||
                  initial.templateId === null
                }
                onClick={() => void sendTest()}
              >
                {testing ? tEd("testing") : tEd("test")}
              </Button>
              <p className="text-petroleum-400 max-w-xs text-xs">
                {dirty ? tEd("saveFirst") : tEd("testNote")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                id="wa-close-button"
                variant="ghost"
                disabled={saving}
                onClick={requestClose}
              >
                {tEd("close")}
              </Button>
              <Button
                disabled={!dirty || saving || !usable}
                onClick={() => void save()}
                title={dirty ? undefined : tEd("unchanged")}
              >
                {saving ? tEd("saving") : tEd("save")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
