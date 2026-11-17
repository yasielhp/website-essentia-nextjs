"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { EditorProps } from "@maily-to/core";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";
import {
  saveMessageTemplate,
  sendTestMessage,
} from "@/actions/message-templates";
import Link from "next/link";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import {
  changedFields,
  docErrorLines,
  flushCurrent,
  insertAtSelection,
  isLinkVariable,
  linkButtonNode,
  openingState,
  variableToken,
  type EmailFields,
  type PendingDoc,
} from "@/lib/messages/editor-state";
import type {
  MessageCatalogEntry,
  MessageDefaultEntry,
  MessageTemplateRowView,
} from "@/lib/messages/types";
import { rowHasText, switchInput } from "@/lib/messages/reminder-switch";
import type { EmailDoc } from "@/types/campaign";
import { useEmailActionToast } from "./action-error";
import { EmailPreviewFrame } from "./email-preview-frame";
import { useMessagePreview, type Problems } from "./use-message-preview";
import { MessagePageHeader, ResetControl, UnsavedBar } from "./page-parts";
import { VariableChips } from "./variable-chips";

// ProseMirror needs a DOM: the editor is loaded after the page, with a
// placeholder as tall as it will be.
const MailyEditor = dynamic(
  () => import("@/components/dashboard/maily-editor"),
  {
    ssr: false,
    loading: () => (
      <div className="bg-sand-100 min-h-64 animate-pulse rounded-2xl" />
    ),
  },
);

type TiptapEditor = Parameters<NonNullable<EditorProps["onCreate"]>>[0];
type TextField = "subject" | "preheader" | "title";
const NO_PROBLEMS: Problems = { fieldErrors: {}, names: null };

/**
 * Edits one message in one language: the subject, the preheader, the title and
 * the body, with the variables it offers, a live preview of the whole email
 * and the notes about what is fixed.
 *
 * It opens on the current text (the saved version, or the default where there
 * is none) and saves only what was changed, so opening and closing it never
 * turns the default into the admin's. The server is the authority on what a
 * body may contain; what it refuses comes back here as lines to fix.
 */
export function MessageEditor({
  messageKey,
  locale,
  saved,
  defaults,
  catalog,
}: {
  messageKey: MessageCatalogEntry["key"];
  locale: "es" | "en";
  /** The admin's version, or null when nothing is saved. */
  saved: MessageTemplateRowView | null;
  defaults: MessageDefaultEntry;
  catalog: MessageCatalogEntry;
}) {
  const t = useTranslations("dashboard.messages.email");
  const tEditor = useTranslations("dashboard.messages.email.editor");
  const tKeys = useTranslations("dashboard.messages.keys");
  const tErrors = useTranslations("dashboard.messages.email.errors");
  const tValidation = useTranslations("dashboard.validation");
  const showError = useEmailActionToast();

  const defaultFields = useMemo<EmailFields>(
    () => ({
      subject: defaults.subject,
      preheader: defaults.preheader,
      title: defaults.title,
      doc: defaults.doc,
    }),
    [defaults],
  );
  // What the editor opened with: the body is handed to the editor once.
  const [opened] = useState<EmailFields>(() =>
    openingState(saved, defaultFields),
  );
  // What counts as saved: the opening state, then whatever was last saved here.
  // The page stays open after a save, so this moves and "changed" is measured
  // from it.
  const [baseline, setBaseline] = useState<EmailFields>(opened);
  const [current, setCurrent] = useState<EmailFields>(opened);
  // What a failed save found, good only while the draft is the one it refused.
  const [refused, setRefused] = useState<{
    problems: Problems;
    changes: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  // "Custom" is a text of the admin's own: a row that holds only the switch
  // is still the default.
  const [hasSaved, setHasSaved] = useState(rowHasText(saved));
  // The reminder's switch is its own state: it saves at once and says nothing
  // about the form, so it is not a change the form asks about.
  const [enabled, setEnabled] = useState(saved ? saved.enabled : true);
  const [switching, setSwitching] = useState(false);

  const editorRef = useRef<TiptapEditor | null>(null);
  const lastField = useRef<TextField | "body">("body");
  const inputs = useRef<Partial<Record<TextField, HTMLInputElement | null>>>(
    {},
  );
  const pendingDoc = useRef<PendingDoc>({ timer: null });
  // A second press while the first is still being answered does nothing.
  const inFlight = useRef(false);

  const changes = changedFields(baseline, current);
  const changesKey = JSON.stringify(changes);
  const dirty = Object.keys(changes).length > 0;
  const guard = useUnsavedGuard(dirty);

  /**
   * The fields as they are this instant. The body reaches `current` a beat
   * after the last keystroke; an action pressed inside that beat takes the
   * editor's own document instead, so the last words are neither lost on save
   * nor missed by the question about unsaved changes.
   */
  function fieldsNow(): EmailFields {
    const now = flushCurrent(
      current,
      pendingDoc.current,
      () => editorRef.current?.getJSON() as EmailDoc | undefined,
    );
    if (now !== current) setCurrent(now);
    return now;
  }

  // What the email would be if this were saved: the draft against the default
  // text, so a saved subject the admin did not touch is still in the preview.
  const preview = useMessagePreview(
    messageKey,
    locale,
    JSON.stringify(changedFields(defaultFields, current)),
  );
  const problems: Problems =
    (refused && refused.changes === changesKey ? refused.problems : null) ??
    preview.problems ??
    NO_PROBLEMS;

  useEffect(() => {
    const pending = pendingDoc.current;
    return () => {
      if (pending.timer) clearTimeout(pending.timer);
    };
  }, []);

  function setText(field: TextField, value: string) {
    setCurrent((before) => ({ ...before, [field]: value }));
  }

  /** Puts a variable where the admin was writing. */
  function insertVariable(name: string) {
    if (isLinkVariable(name)) {
      editorRef.current
        ?.chain()
        .focus()
        .insertContent(linkButtonNode(name, locale))
        .run();
      return;
    }
    const field = lastField.current;
    if (field === "body") {
      editorRef.current
        ?.chain()
        .focus()
        .insertContent({ type: "variable", attrs: { id: name } })
        .run();
      return;
    }
    const input = inputs.current[field];
    const { value, caret } = insertAtSelection(
      current[field],
      input?.selectionStart ?? null,
      input?.selectionEnd ?? null,
      variableToken(name),
    );
    setText(field, value);
    // After React has put the new text in the input.
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(caret, caret);
    });
  }

  async function save() {
    if (inFlight.current) return;
    const now = fieldsNow();
    const toSave = changedFields(baseline, now);
    if (Object.keys(toSave).length === 0) return;
    inFlight.current = true;
    setSaving(true);
    try {
      const result = await saveMessageTemplate(getAccessToken(), {
        key: messageKey,
        channel: "email",
        locale,
        ...toSave,
      });
      if (result.ok) {
        notifySuccess(tEditor("saved"));
        // Still here, and now saved: what was just sent is the new baseline.
        setBaseline(now);
        setHasSaved(true);
        setRefused(null);
        inFlight.current = false;
        setSaving(false);
        return;
      }
      setRefused({
        changes: JSON.stringify(toSave),
        problems: {
          fieldErrors: result.fieldErrors ?? {},
          names: result.detail ?? null,
        },
      });
      showError(result);
    } catch {
      showError({ error: "generic" });
    }
    inFlight.current = false;
    setSaving(false);
  }

  /** Only the switch is sent: the text, saved or not, is not touched. */
  async function toggle() {
    if (inFlight.current || switching) return;
    const next = !enabled;
    setSwitching(true);
    try {
      const result = await saveMessageTemplate(
        getAccessToken(),
        switchInput(messageKey, locale, next),
      );
      if (result.ok) {
        setEnabled(next);
        notifySuccess(next ? t("reminder.turnedOn") : t("reminder.turnedOff"));
      } else {
        showError(result);
      }
    } catch {
      showError({ error: "generic" });
    } finally {
      setSwitching(false);
    }
  }

  async function sendTest() {
    if (inFlight.current) return;
    // The test carries the saved version: with a change in the editor that
    // this render does not know of yet, do not send, let the button say so.
    if (Object.keys(changedFields(baseline, fieldsNow())).length > 0) return;
    inFlight.current = true;
    setTesting(true);
    try {
      const result = await sendTestMessage(
        getAccessToken(),
        messageKey,
        "email",
        locale,
      );
      if (result.ok) notifySuccess(t("testSent", { email: result.to }));
      else showError(result);
    } catch {
      showError({ error: "generic" });
    } finally {
      inFlight.current = false;
      setTesting(false);
    }
  }

  const fieldError = (field: string) => {
    const key = problems.fieldErrors[field];
    if (!key) return null;
    const base = tValidation.has(key)
      ? tValidation(key)
      : tValidation("invalidInput");
    return key === "unknownVariable" && problems.names
      ? `${base} (${tEditor("unknownVariables", { names: problems.names })})`
      : base;
  };
  const docLines = docErrorLines(problems.fieldErrors);

  const textInput = (
    field: TextField,
    label: string,
    hint?: string,
    autoFocus = false,
  ) => {
    const id = `message-${field}`;
    const error = fieldError(field);
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-petroleum-500 text-xs font-medium">
          {label}
        </label>
        <input
          id={id}
          ref={(el) => {
            inputs.current[field] = el;
          }}
          type="text"
          value={current[field]}
          disabled={saving}
          data-autofocus={autoFocus ? "" : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          onFocus={() => {
            lastField.current = field;
          }}
          onChange={(e) => setText(field, e.target.value)}
          className={INPUT_CLASS}
        />
        {error && (
          <p id={`${id}-error`} role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
        {hint && (
          <p id={`${id}-hint`} className="text-petroleum-400 text-xs">
            {hint}
          </p>
        )}
      </div>
    );
  };

  const language = t(`locales.${locale}`);

  return (
    <div className="flex flex-col gap-6">
      <MessagePageHeader
        title={tEditor("title", { name: tKeys(messageKey), language })}
        status={{
          text: hasSaved ? t("status.custom") : t("status.default"),
          tone: hasSaved ? "custom" : "default",
        }}
        extraStatus={
          catalog.canDisable && !enabled ? t("status.disabled") : undefined
        }
        describedBy="message-notice"
      />

      {guard.pending && (
        <UnsavedBar onStay={guard.stay} onLeave={guard.leave} />
      )}

      {catalog.canDisable && (
        <section
          aria-label={t("reminder.switch")}
          className="border-sand-200 flex items-start gap-3 rounded-xl border bg-white px-4 py-3"
        >
          <button
            id="reminder-switch"
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-describedby="reminder-switch-hint"
            disabled={switching || saving}
            onClick={() => void toggle()}
            className={`focus-visible:ring-petroleum-500 relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50 ${
              enabled ? "bg-petroleum-700" : "bg-sand-200"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-5" : ""
              }`}
            />
          </button>
          <div>
            <label
              htmlFor="reminder-switch"
              className="text-petroleum-700 text-sm font-medium"
            >
              {t("reminder.switch")}
            </label>
            <p
              id="reminder-switch-hint"
              className="text-petroleum-400 max-w-xl text-xs"
            >
              {enabled ? t("reminder.hintOn") : t("reminder.hintOff")}
            </p>
            <Link
              href="/dashboard/campaigns/new"
              className="text-petroleum-700 mt-1 inline-block text-xs underline underline-offset-2"
            >
              {t("reminder.forWhatsApp")}
            </Link>
          </div>
        </section>
      )}

      <p
        id="message-notice"
        className="bg-sand-50 text-petroleum-500 rounded-xl px-4 py-3 text-xs"
      >
        {hasSaved ? tEditor("customNotice") : tEditor("seedNotice")}
      </p>

      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          {textInput("subject", tEditor("subject"))}
          {textInput(
            "preheader",
            tEditor("preheader"),
            tEditor("preheaderHint"),
          )}
          {textInput("title", tEditor("titleField"), tEditor("titleHint"))}

          <VariableChips
            variables={catalog.variables}
            disabled={saving}
            onInsert={insertVariable}
          />

          <section className="flex flex-col gap-2">
            <h2
              id="message-body-label"
              className="text-petroleum-500 text-xs font-medium"
            >
              {tEditor("body")}
            </h2>
            <div
              role="group"
              aria-labelledby="message-body-label"
              onFocusCapture={() => {
                lastField.current = "body";
              }}
              className={`rounded-2xl border bg-white px-4 py-2 ${
                docLines.length > 0 ? "border-red-300" : "border-sand-200"
              }`}
            >
              <MailyEditor
                contentJson={opened.doc as never}
                editable={!saving}
                onCreate={(editor) => {
                  editorRef.current = editor;
                }}
                onUpdate={(editor) => {
                  if (pendingDoc.current.timer) {
                    clearTimeout(pendingDoc.current.timer);
                  }
                  pendingDoc.current.timer = setTimeout(() => {
                    pendingDoc.current.timer = null;
                    setCurrent((before) => ({
                      ...before,
                      doc: editor.getJSON() as EmailDoc,
                    }));
                  }, 300);
                }}
              />
            </div>
            {docLines.length > 0 && (
              <div role="alert" className="text-xs text-red-600">
                <p className="font-medium">{tEditor("docErrorsTitle")}</p>
                <ul className="list-disc pl-4">
                  {docLines.map(({ key, block }) => {
                    const message = tValidation.has(key)
                      ? tValidation(key)
                      : tValidation("invalidInput");
                    return (
                      <li key={`${key}-${block}`}>
                        {block === null
                          ? message
                          : tEditor("docErrorAt", { message, block })}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <ul className="text-petroleum-400 list-disc space-y-1 pl-4 text-xs">
              <li>{tEditor("fixedAfter")}</li>
              <li>{tEditor("closingNote")}</li>
              <li>{tEditor("emptyNote")}</li>
            </ul>
          </section>

          <section
            aria-labelledby="message-fixed"
            className="bg-sand-50 rounded-xl px-4 py-3"
          >
            <h2
              id="message-fixed"
              className="text-petroleum-500 text-xs font-medium"
            >
              {tEditor("fixedTitle")}
            </h2>
            {catalog.fixed.length === 0 ? (
              <p className="text-petroleum-400 mt-1 text-xs">
                {tEditor("fixedNone")}
              </p>
            ) : (
              <ul className="text-petroleum-500 mt-1 list-disc pl-4 text-xs">
                {catalog.fixed.map((block) => (
                  <li key={block}>{t(`fixed.${block}`)}</li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* The preview stays in view beside the editor on a wide screen. */}
        <div className="min-w-0 xl:sticky xl:top-6">
          <EmailPreviewFrame
            html={preview.html}
            subject={preview.subject}
            failed={preview.failed}
            failure={
              preview.failure
                ? tErrors.has(preview.failure)
                  ? tErrors(preview.failure)
                  : tErrors("generic")
                : null
            }
          />
        </div>
      </div>

      <div className="border-sand-200 bg-sand-50/95 sticky bottom-0 z-10 -mx-6 flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4 lg:-mx-10 lg:px-10">
        <div className="flex flex-col gap-1">
          <Button
            variant="outline"
            disabled={saving || testing || dirty}
            onClick={() => void sendTest()}
          >
            {testing ? t("actions.testing") : t("actions.test")}
          </Button>
          <p className="text-petroleum-400 max-w-xs text-xs">
            {dirty ? tEditor("saveFirst") : t("testNote")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(hasSaved || !enabled) && (
            <ResetControl
              channel="email"
              messageKey={messageKey}
              locale={locale}
              disabled={saving}
              labels={{
                button: t("actions.reset"),
                working: t("actions.resetting"),
                confirm: t("resetConfirm"),
                yes: t("resetYes"),
                no: t("resetNo"),
              }}
            />
          )}
          <Button
            disabled={!dirty || saving || switching}
            onClick={() => void save()}
            title={dirty ? undefined : tEditor("unchanged")}
          >
            {saving ? tEditor("saving") : tEditor("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
