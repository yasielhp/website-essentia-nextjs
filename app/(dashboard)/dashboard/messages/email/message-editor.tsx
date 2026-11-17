"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { EditorProps } from "@maily-to/core";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";
import {
  previewMessage,
  saveMessageTemplate,
  sendTestMessage,
} from "@/actions/message-templates";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import {
  changedFields,
  docErrorLines,
  insertAtSelection,
  isLinkVariable,
  linkButtonNode,
  openingState,
  variableToken,
  type EmailFields,
} from "@/lib/messages/editor-state";
import type {
  MessageCatalogEntry,
  MessageDefaultEntry,
  MessageTemplateRowView,
} from "@/lib/messages/types";
import type { EmailDoc } from "@/types/campaign";
import { Modal } from "../whatsapp/modal";
import { useEmailActionToast } from "./action-error";
import { EmailPreviewFrame } from "./email-preview-frame";

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
type Problems = { fieldErrors: Record<string, string>; names: string | null };

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
  onClose,
  onSaved,
}: {
  messageKey: MessageCatalogEntry["key"];
  locale: "es" | "en";
  /** The admin's version, or null when nothing is saved. */
  saved: MessageTemplateRowView | null;
  defaults: MessageDefaultEntry;
  catalog: MessageCatalogEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("dashboard.messages.email");
  const tEditor = useTranslations("dashboard.messages.email.editor");
  const tKeys = useTranslations("dashboard.messages.keys");
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
  // What the editor opened with: fixed for the life of the modal.
  const [opened] = useState<EmailFields>(() =>
    openingState(saved, defaultFields),
  );
  const [current, setCurrent] = useState<EmailFields>(opened);
  const [problems, setProblems] = useState<Problems>(NO_PROBLEMS);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [preview, setPreview] = useState<{
    html: string | null;
    subject: string | null;
    failed: boolean;
  }>({ html: null, subject: null, failed: false });

  const editorRef = useRef<TiptapEditor | null>(null);
  const lastField = useRef<TextField | "body">("body");
  const inputs = useRef<Partial<Record<TextField, HTMLInputElement | null>>>(
    {},
  );
  const pendingDoc = useRef<ReturnType<typeof setTimeout> | null>(null);

  const changes = changedFields(opened, current);
  const dirty = Object.keys(changes).length > 0;
  const hasSaved = saved !== null;

  // What the email would be if this were saved: the draft against the default
  // text, so a saved subject the admin did not touch is still in the preview.
  const draft = JSON.stringify(changedFields(defaultFields, current));
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void previewMessage(
        getAccessToken(),
        messageKey,
        locale,
        JSON.parse(draft),
      )
        .catch(() => null)
        .then((result) => {
          if (cancelled || !result) return;
          if (result.ok) {
            setPreview({
              html: result.html,
              subject: result.subject,
              failed: false,
            });
            setProblems(NO_PROBLEMS);
          } else {
            setPreview((before) => ({ ...before, failed: true }));
            setProblems({
              fieldErrors: result.fieldErrors ?? {},
              names: result.detail ?? null,
            });
          }
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft, messageKey, locale]);

  useEffect(
    () => () => {
      if (pendingDoc.current) clearTimeout(pendingDoc.current);
    },
    [],
  );

  function requestClose() {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

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
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const result = await saveMessageTemplate(getAccessToken(), {
        key: messageKey,
        channel: "email",
        locale,
        ...changes,
      });
      if (result.ok) {
        notifySuccess(tEditor("saved"));
        onSaved();
        return;
      }
      setProblems({
        fieldErrors: result.fieldErrors ?? {},
        names: result.detail ?? null,
      });
      showError(result);
    } catch {
      showError({ error: "generic" });
    }
    setSaving(false);
  }

  async function sendTest() {
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
    <Modal
      title={tEditor("title", { name: tKeys(messageKey), language })}
      onClose={requestClose}
      wide
      dirty={dirty}
      busy={saving}
    >
      <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">
        <p className="bg-sand-50 text-petroleum-500 rounded-xl px-4 py-3 text-xs">
          {hasSaved ? tEditor("customNotice") : tEditor("seedNotice")}
        </p>

        {textInput("subject", tEditor("subject"), undefined, true)}
        {textInput("preheader", tEditor("preheader"), tEditor("preheaderHint"))}
        {textInput("title", tEditor("titleField"), tEditor("titleHint"))}

        <section
          aria-labelledby="message-variables"
          className="flex flex-col gap-2"
        >
          <h3
            id="message-variables"
            className="text-petroleum-500 text-xs font-medium"
          >
            {tEditor("variablesTitle")}
          </h3>
          <p className="text-petroleum-400 text-xs">
            {tEditor("variablesHint")}
            {catalog.variables.some(isLinkVariable) &&
              ` ${tEditor("variablesLinkHint")}`}
          </p>
          <ul className="flex flex-wrap gap-2">
            {catalog.variables.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  disabled={saving}
                  // Keep the caret where it was in the field being written.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertVariable(name)}
                  className="border-sand-200 text-petroleum-700 hover:border-petroleum-400 rounded-full border bg-white px-3 py-1 text-xs transition-colors disabled:opacity-50"
                >
                  {t(`variables.${name}`)}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h3
            id="message-body-label"
            className="text-petroleum-500 text-xs font-medium"
          >
            {tEditor("body")}
          </h3>
          <div
            role="group"
            aria-labelledby="message-body-label"
            onFocusCapture={() => {
              lastField.current = "body";
            }}
            className={`rounded-2xl border px-4 py-2 ${
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
                if (pendingDoc.current) clearTimeout(pendingDoc.current);
                pendingDoc.current = setTimeout(() => {
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
          <h3
            id="message-fixed"
            className="text-petroleum-500 text-xs font-medium"
          >
            {tEditor("fixedTitle")}
          </h3>
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

        <EmailPreviewFrame
          html={preview.html}
          subject={preview.subject}
          failed={preview.failed}
        />
      </div>

      <div className="border-sand-100 flex shrink-0 flex-col gap-3 border-t px-6 py-4">
        {confirmDiscard ? (
          <div
            role="alertdialog"
            aria-label={tEditor("discardTitle")}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-petroleum-700 text-sm font-medium">
              {tEditor("discardTitle")}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDiscard(false)}
              >
                {tEditor("discardNo")}
              </Button>
              <Button variant="danger" onClick={onClose}>
                {tEditor("discardYes")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
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
              <Button variant="ghost" disabled={saving} onClick={requestClose}>
                {tEditor("close")}
              </Button>
              <Button
                disabled={!dirty || saving}
                onClick={() => void save()}
                title={dirty ? undefined : tEditor("unchanged")}
              >
                {saving ? tEditor("saving") : tEditor("save")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
