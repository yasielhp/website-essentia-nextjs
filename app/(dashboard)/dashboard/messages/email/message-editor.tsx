"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { EditorProps } from "@maily-to/core";
import { NodeSelection } from "@tiptap/pm/state";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";
import {
  saveMessageTemplate,
  sendTestMessage,
} from "@/actions/message-templates";
import Link from "next/link";
import { useMessageDraft } from "@/hooks/use-message-draft";
import { headerActions } from "@/lib/messages/header-actions";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { NEW_APPOINTMENT_NOTICE_HREF } from "@/lib/campaigns/new-start";
import {
  draftKey,
  emailDraftOffer,
  validateEmailDraft,
} from "@/lib/messages/draft";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import {
  changedFields,
  docErrorLines,
  flushCurrent,
  insertAtSelection,
  isLinkVariable,
  plainDoc,
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
import { rowHasText } from "@/lib/messages/reminder-switch";
import {
  BLOCK_NODE,
  blockNode,
  insertIndexFor,
  isEmailLine,
  missingBlocks,
  withKickerSlot,
} from "@/lib/messages/email-doc";
import { requiredBlocks, type FixedBlock } from "@/lib/messages/catalog";
import type { EmailDoc } from "@/types/campaign";
import { useEmailActionToast } from "./action-error";
import { EmailPreviewFrame } from "./email-preview-frame";
import { useMessagePreview, type Problems } from "./use-message-preview";
import {
  DraftBanner,
  MessagePageHeader,
  ResetButton,
  TestAction,
  ResetDialog,
  UnsavedBar,
  useMessageReset,
} from "./page-parts";
import { LanguageSwitch } from "./language-switch";
import { bodyVariableRenderer } from "./variable-kind-ui";
import { BodyToolbar } from "./body-toolbar";
import { emailNodeExtensions, type EmailNodesUi } from "./email-node-views";

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

/** The editor's document as plain JSON, or undefined before there is an editor. */
const plainDocOf = (editor: TiptapEditor | null): EmailDoc | undefined =>
  editor ? plainDoc(editor.getJSON() as EmailDoc) : undefined;
type TextField = "subject" | "preheader";
const NO_PROBLEMS: Problems = { fieldErrors: {}, names: null };

/**
 * Edits one message in one language: the subject, the preheader and the whole
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
      doc: defaults.doc,
    }),
    [defaults],
  );
  // What the editor opened with: the body is handed to the editor once. A row
  // saved before the title and the blocks were in the document is converted.
  const [opened] = useState<EmailFields>(() =>
    openingState(
      saved,
      { ...defaultFields, title: defaults.title },
      messageKey,
    ),
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
  // Whether the message is switched on. The switch is in the list of messages,
  // not here: this page only says so when it is off.
  const enabled = saved ? saved.enabled !== false : true;

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
  // The body the editor is asked to show once it exists (a recovered draft).
  const recoveredDoc = useRef<EmailDoc | null>(null);
  const draft = useMessageDraft<EmailFields>({
    kind: "email",
    storageKey: draftKey("email", messageKey, locale),
    validate: validateEmailDraft,
    offerOf: (stored) => emailDraftOffer(stored, opened),
    current,
    dirty,
    // The body reaches `current` a beat after the keystroke: the last write
    // takes the editor's own document, so a back button inside that beat keeps it.
    snapshot: () =>
      flushCurrent(current, pendingDoc.current, () =>
        plainDocOf(editorRef.current),
      ),
  });

  // A variable in the body is drawn like its chip: its icon, its colour, its name.
  const renderVariable = useMemo(
    () =>
      bodyVariableRenderer(
        (name) =>
          t.has(`variableShort.${name}`) ? t(`variableShort.${name}`) : name,
        (name) => (t.has(`variables.${name}`) ? t(`variables.${name}`) : name),
      ),
    [t],
  );

  // Where the caret is, and which blocks of the message the document lacks.
  const [inLine, setInLine] = useState(false);
  const touchedEditor = useRef(false);
  const missing = useMemo(
    () => missingBlocks(current.doc, messageKey),
    [current.doc, messageKey],
  );
  // What this email must carry and the document lacks: said over the editor, and
  // Save waits for it (the server refuses the same, and sending adds it).
  const mustHave = useMemo(
    () => requiredBlocks(messageKey).filter((block) => missing.includes(block)),
    [messageKey, missing],
  );
  // The editor's own nodes for the whole email, drawn in the page's words. Built
  // once: the editor is.
  const nodes = useMemo(() => {
    const ui: EmailNodesUi = {
      titleLabel: tEditor("titleLabel"),
      kickerLabel: tEditor("kickerLabel"),
      kickerPlaceholder: tEditor("kickerPlaceholder"),
      blockName: (block) => t(`fixed.${block}`),
      blockWhat: (block) => tEditor(`blockWhat.${block}`),
      up: (name) => tEditor("blockUp", { name }),
      down: (name) => tEditor("blockDown", { name }),
      remove: (name) => tEditor("blockRemove", { name }),
      drag: (name) => tEditor("blockDrag", { name }),
    };
    return emailNodeExtensions(ui);
    // Built once with the page's words: the editor keeps what it was given.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useMessageReset({
    channel: "email",
    messageKey,
    locale,
    onBeforeLeave: draft.forget,
  });
  const actions = headerActions({
    channel: "email",
    dirty,
    saving,
    testing,
    hasSaved,
    canTest: true,
    hasTemplate: true,
    usable: true,
  });
  const resetLabels = {
    button: t("actions.reset"),
    working: t("actions.resetting"),
    title: t("resetDialog.title", {
      name: tKeys(messageKey),
      language: t(`locales.${locale}`),
    }),
    body: t("resetDialog.body"),
    // The reminder, switched off: a reset keeps it off, and says so before.
    note: !enabled ? t("resetDialog.keepsOff") : undefined,
    yes: t("resetDialog.yes"),
    no: t("resetNo"),
  };

  function recoverDraft() {
    const recovered = draft.take();
    if (!recovered) return;
    setCurrent(recovered);
    if (editorRef.current) {
      editorRef.current.commands.setContent(withKickerSlot(recovered.doc));
    } else recoveredDoc.current = recovered.doc;
  }

  /**
   * The fields as they are this instant. The body reaches `current` a beat
   * after the last keystroke; an action pressed inside that beat takes the
   * editor's own document instead, so the last words are neither lost on save
   * nor missed by the question about unsaved changes.
   */
  function fieldsNow(): EmailFields {
    const now = flushCurrent(current, pendingDoc.current, () =>
      plainDocOf(editorRef.current),
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

  /**
   * Puts a variable where the admin was writing: in the subject or the preheader
   * as text, in the body at the caret (the title included, where an address has
   * no place). A block selected as a whole is not written over: what is inserted
   * goes after it, as its own line.
   */
  function insertVariable(name: string) {
    const field = lastField.current;
    if (field === "body") {
      const editor = editorRef.current;
      if (!editor) return;
      const { selection } = editor.state;
      const inLine = isEmailLine(selection.$from.parent.type.name);
      const link = isLinkVariable(name);
      if (link && inLine) return;
      // The editor opens with the caret in the first line (the kicker, or the
      // title); until the admin has chosen a place, a variable goes to the text
      // under them.
      if (!touchedEditor.current && !editor.isFocused) {
        let at = 0;
        editor.state.doc.forEach((child, offset) => {
          if (at === 0 && child.isTextblock && !isEmailLine(child.type.name)) {
            at = offset + 1;
          }
        });
        if (at > 0) editor.commands.setTextSelection(at);
      }
      const node = link
        ? linkButtonNode(name, locale)
        : { type: "variable", attrs: { id: name } };
      if (selection instanceof NodeSelection) {
        editor
          .chain()
          .focus()
          .insertContentAt(
            selection.to,
            link ? node : { type: "paragraph", content: [node] },
          )
          .run();
        return;
      }
      editor.chain().focus().insertContent(node).run();
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

  /** Puts a block that was taken out back where the message has always had it. */
  function addBlock(block: FixedBlock) {
    const editor = editorRef.current;
    if (!editor) return;
    const { doc } = editor.state;
    const kinds: (string | null)[] = [];
    doc.forEach((node) =>
      kinds.push(
        node.type.name === BLOCK_NODE ? String(node.attrs.kind) : null,
      ),
    );
    const index = insertIndexFor(kinds, block, messageKey);
    let pos = 0;
    for (let i = 0; i < index; i++) pos += doc.child(i).nodeSize;
    editor.chain().focus().insertContentAt(pos, blockNode(block)).run();
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-block-kind="${block}"]`)
        ?.scrollIntoView({ block: "nearest" });
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

  const textInput = (field: TextField, label: string, hint?: string) => {
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

  return (
    <div className="flex flex-col gap-6">
      <MessagePageHeader
        title={tEditor("title", { name: tKeys(messageKey) })}
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
              disabled={actions.save.disabled || mustHave.length > 0}
              title={
                mustHave.length > 0
                  ? tEditor("saveBlocked")
                  : dirty
                    ? undefined
                    : tEditor("unchanged")
              }
              aria-describedby={
                mustHave.length > 0 ? "message-missing-blocks" : undefined
              }
              onClick={() => void save()}
            >
              {saving ? tEditor("saving") : tEditor("save")}
            </Button>
          </>
        }
      />

      {reset.asking && (
        <ResetDialog
          labels={resetLabels}
          busy={reset.busy}
          error={reset.error}
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

      {!enabled && (
        <p
          id="message-off-note"
          className="text-petroleum-400 -mt-2 max-w-xl text-xs"
        >
          {t("offNote")}
        </p>
      )}

      {messageKey === "booking_reminder" && (
        <p className="-mt-2 px-1">
          <Link
            href={NEW_APPOINTMENT_NOTICE_HREF}
            className="text-petroleum-700 inline-block text-xs underline underline-offset-2"
          >
            {t("reminder.forWhatsApp")}
          </Link>
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <LanguageSwitch
            channel="email"
            messageKey={messageKey}
            locale={locale}
          />
          {textInput("subject", tEditor("subject"))}
          {textInput(
            "preheader",
            tEditor("preheader"),
            tEditor("preheaderHint"),
          )}

          <section className="flex flex-col gap-2">
            <h2
              id="message-body-label"
              className="text-petroleum-500 text-xs font-medium"
            >
              {tEditor("body")}
            </h2>
            <p id="message-body-hint" className="text-petroleum-400 text-xs">
              {tEditor("bodyHint")}
            </p>
            {mustHave.length > 0 && (
              <div
                id="message-missing-blocks"
                role="alert"
                className="flex flex-col gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3"
              >
                {mustHave.map((block) => (
                  <div
                    key={block}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <p className="text-sm font-medium text-red-700">
                      {tEditor("blockMissing", { name: t(`fixed.${block}`) })}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 sm:h-8"
                      onClick={() => addBlock(block)}
                    >
                      {tEditor("blockAdd")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {/* One card: the bar of variables over the whole email. */}
            <div
              className={`rounded-2xl border bg-white ${
                docLines.length > 0 ? "border-red-300" : "border-sand-200"
              }`}
            >
              <BodyToolbar
                variables={catalog.variables}
                disabled={saving}
                inLine={inLine}
                missing={missing}
                onInsert={insertVariable}
                onAddBlock={addBlock}
              />
              <div
                role="group"
                aria-labelledby="message-body-label"
                aria-describedby="message-body-hint"
                onFocusCapture={() => {
                  lastField.current = "body";
                }}
                className="px-4 py-2"
              >
                <MailyEditor
                  renderVariable={renderVariable}
                  nodes={nodes}
                  // The size of the email's own text (15 px, 1.6), not the page's.
                  contentClassName="[&>p]:!text-[15px] [&>p]:!leading-[1.6]"
                  contentJson={withKickerSlot(opened.doc) as never}
                  editable={!saving}
                  onCreate={(editor) => {
                    editorRef.current = editor;
                    if (recoveredDoc.current) {
                      editor.commands.setContent(
                        withKickerSlot(recoveredDoc.current),
                      );
                      recoveredDoc.current = null;
                    }
                    const sync = () =>
                      setInLine(
                        isEmailLine(
                          editor.state.selection.$from.parent.type.name,
                        ),
                      );
                    editor.on("selectionUpdate", sync);
                    editor.on("focus", () => {
                      touchedEditor.current = true;
                      sync();
                    });
                  }}
                  onUpdate={(editor) => {
                    if (pendingDoc.current.timer) {
                      clearTimeout(pendingDoc.current.timer);
                    }
                    pendingDoc.current.timer = setTimeout(() => {
                      pendingDoc.current.timer = null;
                      setCurrent((before) => ({
                        ...before,
                        doc: plainDoc(editor.getJSON() as EmailDoc),
                      }));
                    }, 300);
                  }}
                />
              </div>
            </div>
            {docLines.length > 0 && (
              <div role="alert" className="text-xs text-red-600">
                <p className="font-medium">{tEditor("docErrorsTitle")}</p>
                <ul className="list-disc pl-4">
                  {docLines.map(({ key, block, blockKind }) => {
                    const message = tValidation.has(key)
                      ? tValidation(
                          key,
                          blockKind ? { name: t(`fixed.${blockKind}`) } : {},
                        )
                      : tValidation("invalidInput");
                    return (
                      <li key={`${key}-${block}-${blockKind ?? ""}`}>
                        {block === null
                          ? message
                          : tEditor("docErrorAt", { message, block })}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </div>

        {/* The preview stays in view beside the editor on a wide screen. */}
        {/* Not pinned: the preview is as tall as the email, and scrolls with the page. */}
        <div className="flex min-w-0 flex-col gap-4">
          <EmailPreviewFrame
            html={preview.html}
            failed={preview.failed}
            failure={
              preview.failure
                ? tErrors.has(preview.failure)
                  ? tErrors(preview.failure)
                  : tErrors("generic")
                : null
            }
          />
          <TestAction
            label={testing ? t("actions.testing") : t("actions.test")}
            disabled={actions.test.disabled}
            onClick={() => void sendTest()}
            help={{
              text:
                actions.help === "saveFirst"
                  ? tEditor("saveFirst")
                  : t("testNote"),
              quiet: actions.help !== "saveFirst",
            }}
          />
        </div>
      </div>
    </div>
  );
}
