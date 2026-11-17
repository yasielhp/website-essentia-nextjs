"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useReducer,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { IconPlus, IconTrash } from "@/components/ui/icons";
import { OptionSelect } from "@/components/ui/option-select";
import { INPUT_CLASS, TEXTAREA_CLASS } from "@/constants/form-styles";
import { createWhatsAppTemplate } from "@/actions/whatsapp-templates";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { validateWhatsAppTemplate } from "@/lib/schemas";
import { countParams, paramIssues } from "@/lib/whatsapp/templates";
import { nextTemplateName } from "@/lib/whatsapp/template-ui";
import {
  WHATSAPP_TEMPLATE_CATEGORIES,
  type WhatsAppTemplateCategory,
  type WhatsAppTemplateRow,
} from "@/lib/whatsapp/types";
import { useDialogFocus } from "@/hooks/use-dialog-focus";
import { useActionToast } from "./action-error";
import { closeDecision } from "./close-decision";
import { Modal } from "./modal";
import { TemplatePreview } from "@/components/dashboard/template-preview";

/** `es` and `en` are the choices; a rewritten template may carry another. */
type Language = string;
type ButtonType = "URL" | "QUICK_REPLY";

/** A button as typed: both fields are kept so switching type loses nothing. */
type ButtonDraft = { type: ButtonType; text: string; url: string };

type FormState = {
  name: string;
  language: Language;
  category: WhatsAppTemplateCategory;
  headerText: string;
  body: string;
  footerText: string;
  buttons: ButtonDraft[];
  /** One per parameter, by position; the form shows as many as the body has. */
  examples: string[];
  /** Keyed like the action's `fieldErrors`: `body`, `buttons.0.url`… */
  errors: Record<string, string>;
  /** The action said this name and language are already taken. */
  nameTaken: boolean;
  submitting: boolean;
};

type TextField = "name" | "headerText" | "body" | "footerText";

type FormAction =
  | { type: "set"; field: TextField; value: string }
  | { type: "language"; value: Language }
  | { type: "category"; value: WhatsAppTemplateCategory }
  | { type: "example"; index: number; value: string }
  | { type: "addButton" }
  | { type: "removeButton"; index: number }
  | { type: "button"; index: number; patch: Partial<ButtonDraft> }
  | { type: "errors"; errors: Record<string, string>; nameTaken?: boolean }
  | { type: "submitting"; value: boolean };

const MAX_BUTTONS = 3;

/** The errors minus every key `drop` says goes. */
function dropErrors(
  errors: Record<string, string>,
  drop: (key: string) => boolean,
): Record<string, string> {
  return Object.fromEntries(Object.entries(errors).filter(([k]) => !drop(k)));
}

function reducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "set":
      return {
        ...state,
        [action.field]: action.value,
        errors: dropErrors(state.errors, (k) => k === action.field),
        nameTaken: action.field === "name" ? false : state.nameTaken,
      };
    case "language":
      return { ...state, language: action.value, nameTaken: false };
    case "category":
      return { ...state, category: action.value };
    case "example": {
      const examples = [...state.examples];
      examples[action.index] = action.value;
      return {
        ...state,
        examples,
        errors: dropErrors(
          state.errors,
          (k) => k === `exampleParams.${action.index}`,
        ),
      };
    }
    case "addButton":
      if (state.buttons.length >= MAX_BUTTONS) return state;
      return {
        ...state,
        buttons: [...state.buttons, { type: "QUICK_REPLY", text: "", url: "" }],
        errors: dropErrors(state.errors, (k) => k === "buttons"),
      };
    case "removeButton":
      return {
        ...state,
        buttons: state.buttons.filter((_, i) => i !== action.index),
        // Every `buttons.n.*` path shifts when one goes, so none can be trusted.
        errors: dropErrors(state.errors, (k) => k.startsWith("buttons")),
      };
    case "button":
      return {
        ...state,
        buttons: state.buttons.map((b, i) =>
          i === action.index ? { ...b, ...action.patch } : b,
        ),
        errors: dropErrors(state.errors, (k) =>
          k.startsWith(`buttons.${action.index}.`),
        ),
      };
    case "errors":
      return {
        ...state,
        errors: action.errors,
        nameTaken: action.nameTaken ?? false,
      };
    case "submitting":
      return { ...state, submitting: action.value };
  }
}

function initialState(
  seed: WhatsAppTemplateRow | null,
  name: string,
): FormState {
  return {
    name,
    // Kept as it came: a template in another language is shown, and the
    // schema says it cannot be sent from here, instead of becoming Spanish.
    language: seed?.language ?? "es",
    category: seed?.category ?? "UTILITY",
    headerText: seed?.header_text ?? "",
    body: seed?.body ?? "",
    footerText: seed?.footer_text ?? "",
    buttons: (seed?.buttons ?? []).map((b) => ({
      type: b.type,
      text: b.text,
      url: b.type === "URL" ? b.url : "",
    })),
    examples: seed?.example_params ?? [],
    errors: {},
    nameTaken: false,
    submitting: false,
  };
}

/** One example per parameter the body has, empty where none was typed. */
function examplesFor(state: FormState): string[] {
  return Array.from(
    { length: countParams(state.body) },
    (_, i) => state.examples[i] ?? "",
  );
}

/** What the action takes. */
function toInput(state: FormState) {
  return {
    name: state.name,
    language: state.language,
    category: state.category,
    headerText: state.headerText,
    body: state.body,
    footerText: state.footerText,
    buttons: state.buttons.map((b) =>
      b.type === "URL"
        ? ({ type: "URL", text: b.text, url: b.url } as const)
        : ({ type: "QUICK_REPLY", text: b.text } as const),
    ),
    exampleParams: examplesFor(state),
  };
}

/** Whether anything was typed that the seed did not already hold. */
function isDirty(state: FormState, initial: FormState): boolean {
  return (
    state.name !== initial.name ||
    state.language !== initial.language ||
    state.category !== initial.category ||
    state.headerText !== initial.headerText ||
    state.body !== initial.body ||
    state.footerText !== initial.footerText ||
    JSON.stringify(state.buttons) !== JSON.stringify(initial.buttons) ||
    JSON.stringify(state.examples) !== JSON.stringify(initial.examples)
  );
}

function ErrorLine({ code, id }: { code: string; id?: string }) {
  const tValidation = useTranslations("dashboard.validation");
  return (
    <p id={id} role="alert" className="text-xs text-red-600">
      {tValidation.has(code) ? tValidation(code) : tValidation("invalidInput")}
    </p>
  );
}

/**
 * A labelled field. Its help and error lines are tied to the control with
 * `aria-describedby`, so a screen reader reads them with it; `describedBy`
 * names other lines that belong to the same control.
 */
function Field({
  id,
  label,
  help,
  error,
  describedBy = [],
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  describedBy?: string[];
  children: React.ReactNode;
}) {
  const ids = [
    error ? `${id}-error` : null,
    help ? `${id}-help` : null,
    ...describedBy,
  ].filter(Boolean);
  const described = ids.length > 0 ? ids.join(" ") : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-petroleum-500 text-xs font-medium">
        {label}
      </label>
      {Children.map(children, (child) =>
        isValidElement<{ "aria-describedby"?: string }>(child) &&
        (child.type === "input" || child.type === "textarea")
          ? cloneElement(child, { "aria-describedby": described })
          : child,
      )}
      {error && <ErrorLine id={`${id}-error`} code={error} />}
      {help && (
        <p id={`${id}-help`} className="text-petroleum-400 text-xs">
          {help}
        </p>
      )}
    </div>
  );
}

/** What Meta would refuse in the body, said while the admin is still typing. */
function LiveIssues({ issues, id }: { issues: string[]; id: string }) {
  const tValidation = useTranslations("dashboard.validation");
  if (issues.length === 0) return null;
  return (
    <ul id={id} className="flex flex-col gap-0.5">
      {issues.map((issue) => (
        <li key={issue} className="text-xs text-yellow-700">
          {tValidation(issue)}
        </li>
      ))}
    </ul>
  );
}

/** Moves the cursor to the first field the validation flagged. */
function focusFirstError(form: HTMLFormElement | null) {
  // The errors render on the next frame; look for the flagged field then.
  requestAnimationFrame(() => {
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}

/** "Discard this template?" in the footer; focus goes to keeping and back to Cancel. */
function DiscardBar({
  onKeep,
  onDiscard,
}: {
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("dashboard.messages.whatsapp.form");
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, () => document.getElementById("template-cancel-button"));
  return (
    <div
      ref={ref}
      role="alertdialog"
      aria-label={t("discardConfirm")}
      className="flex w-full flex-wrap items-center justify-between gap-3"
    >
      <p className="text-petroleum-700 text-sm font-medium">
        {t("discardConfirm")}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onKeep}>
          {t("discardKeep")}
        </Button>
        <Button variant="danger" onClick={onDiscard}>
          {t("discardYes")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Writes a WhatsApp template and sends it to Meta for review.
 *
 * `seed` is the rejected template being rewritten: its text comes along and the
 * name is replaced, because Meta will not take the same name and language twice.
 * Without a WABA on the server the action keeps the template as a draft, and
 * the form says so before the admin presses the button.
 */
export function TemplateForm({
  seed,
  configured,
  takenNames,
  onClose,
  onCreated,
}: {
  seed: WhatsAppTemplateRow | null;
  configured: boolean;
  /** Names already in use, to suggest a free one. */
  takenNames: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations("dashboard.messages.whatsapp");
  const tCommon = useTranslations("dashboard.common");
  const showError = useActionToast();
  const [initial] = useState(() =>
    initialState(seed, seed ? nextTemplateName(seed.name, takenNames) : ""),
  );
  const [state, dispatch] = useReducer(reducer, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [asking, setAsking] = useState(false);
  const dirty = isDirty(state, initial);
  /** Escape, the X and Cancel all come here: a template written is not lost unasked. */
  function requestClose() {
    const decision = closeDecision({ dirty, submitting: state.submitting });
    if (decision === "close") onClose();
    else if (decision === "ask") setAsking(true);
  }

  const params = countParams(state.body);
  const examples = examplesFor(state);
  const liveIssues: string[] = state.body.trim() ? paramIssues(state.body) : [];
  // A parameter error is already on screen as a live issue; say it once.
  const bodyError =
    state.errors.body && !liveIssues.includes(state.errors.body)
      ? state.errors.body
      : undefined;
  const languageOptions = ["es", "en", initial.language]
    .filter((code, i, all) => all.indexOf(code) === i)
    .map((code) => ({
      value: code,
      label: t.has(`languages.${code}`) ? t(`languages.${code}`) : code,
    }));
  const suggestion = nextTemplateName(state.name || "plantilla", takenNames);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (state.submitting) return;

    const input = toInput(state);
    const check = validateWhatsAppTemplate(input);
    if (!check.ok) {
      dispatch({ type: "errors", errors: check.fieldErrors });
      showError({ error: "invalid" });
      focusFirstError(formRef.current);
      return;
    }

    dispatch({ type: "submitting", value: true });
    try {
      const result = await createWhatsAppTemplate(getAccessToken(), check.data);
      if (result.ok) {
        notifySuccess(
          t(
            result.status === "draft"
              ? "toasts.draftSaved"
              : "toasts.submitted",
          ),
        );
        onCreated();
        return;
      }
      if (result.error === "templateExists") {
        dispatch({ type: "errors", errors: {}, nameTaken: true });
      } else if (result.fieldErrors) {
        dispatch({ type: "errors", errors: result.fieldErrors });
        focusFirstError(formRef.current);
      }
      showError(result, { afterSubmit: true });
    } catch {
      showError({ error: "generic" }, { afterSubmit: true });
    }
    dispatch({ type: "submitting", value: false });
  }

  return (
    <Modal
      title={t(seed ? "form.rewriteTitle" : "form.title")}
      onClose={requestClose}
      wide
      dirty={dirty}
      busy={state.submitting}
    >
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="grid gap-6 overflow-y-auto px-6 py-5 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-4">
            <p
              className={`rounded-xl px-4 py-3 text-xs ${
                configured
                  ? "bg-sand-50 text-petroleum-500"
                  : "bg-yellow-50 text-yellow-800"
              }`}
            >
              {configured ? t("form.reviewNotice") : t("form.draftNotice")}
            </p>

            <Field
              id="wa-name"
              label={t("fields.name")}
              help={t("help.name")}
              error={state.errors.name}
              describedBy={state.nameTaken ? ["wa-name-taken"] : []}
            >
              <input
                id="wa-name"
                name="name"
                type="text"
                value={state.name}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    field: "name",
                    value: e.target.value,
                  })
                }
                disabled={state.submitting}
                aria-invalid={Boolean(state.errors.name) || state.nameTaken}
                data-autofocus
                autoComplete="off"
                spellCheck={false}
                className={INPUT_CLASS}
              />
              {state.nameTaken && (
                <div className="flex flex-wrap items-center gap-3">
                  <p
                    id="wa-name-taken"
                    role="alert"
                    className="text-xs text-red-600"
                  >
                    {t("form.nameTaken")}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "set",
                        field: "name",
                        value: suggestion,
                      })
                    }
                    className="text-petroleum-700 text-xs font-medium underline"
                  >
                    {t("form.useName", { name: suggestion })}
                  </button>
                </div>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="wa-language"
                label={t("fields.language")}
                error={state.errors.language}
              >
                <OptionSelect<Language>
                  id="wa-language"
                  value={state.language}
                  options={languageOptions}
                  onChange={(value) => dispatch({ type: "language", value })}
                  disabled={state.submitting}
                  ariaLabel={t("fields.language")}
                />
              </Field>
              <Field
                id="wa-category"
                label={t("fields.category")}
                error={state.errors.category}
              >
                <OptionSelect<WhatsAppTemplateCategory>
                  id="wa-category"
                  value={state.category}
                  options={WHATSAPP_TEMPLATE_CATEGORIES.map((value) => ({
                    value,
                    label: t(`categories.${value}`),
                  }))}
                  onChange={(value) => dispatch({ type: "category", value })}
                  disabled={state.submitting}
                  ariaLabel={t("fields.category")}
                />
              </Field>
            </div>
            <p className="text-petroleum-400 -mt-2 text-xs">
              {t("help.category")}
            </p>

            <Field
              id="wa-header"
              label={t("fields.header")}
              help={t("help.header")}
              error={state.errors.headerText}
            >
              <input
                id="wa-header"
                name="headerText"
                type="text"
                value={state.headerText}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    field: "headerText",
                    value: e.target.value,
                  })
                }
                disabled={state.submitting}
                aria-invalid={Boolean(state.errors.headerText)}
                className={INPUT_CLASS}
              />
            </Field>

            <Field
              id="wa-body"
              label={t("fields.body")}
              help={t("help.body")}
              error={bodyError}
              describedBy={liveIssues.length > 0 ? ["wa-body-issues"] : []}
            >
              <textarea
                id="wa-body"
                name="body"
                rows={6}
                value={state.body}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    field: "body",
                    value: e.target.value,
                  })
                }
                disabled={state.submitting}
                aria-invalid={Boolean(state.errors.body)}
                className={TEXTAREA_CLASS}
              />
              <p className="text-petroleum-500 text-right text-xs font-medium tabular-nums">
                {t("paramCount", { count: params })}
                {" · "}
                {state.body.length}/1024
              </p>
              <LiveIssues issues={liveIssues} id="wa-body-issues" />
            </Field>

            {params > 0 && (
              <fieldset className="flex flex-col gap-3">
                <legend className="text-petroleum-500 mb-1 text-xs font-medium">
                  {t("fields.examples")}
                </legend>
                {examples.map((value, i) => (
                  <Field
                    key={i}
                    id={`wa-example-${i}`}
                    label={t("form.exampleN", { n: i + 1 })}
                    error={state.errors[`exampleParams.${i}`]}
                  >
                    <input
                      id={`wa-example-${i}`}
                      name={`exampleParams.${i}`}
                      type="text"
                      value={value}
                      onChange={(e) =>
                        dispatch({
                          type: "example",
                          index: i,
                          value: e.target.value,
                        })
                      }
                      disabled={state.submitting}
                      aria-invalid={Boolean(state.errors[`exampleParams.${i}`])}
                      className={INPUT_CLASS}
                    />
                  </Field>
                ))}
                <p className="text-petroleum-400 text-xs">
                  {t("help.examples")}
                </p>
                {state.errors.exampleParams && (
                  <ErrorLine code={state.errors.exampleParams} />
                )}
              </fieldset>
            )}

            <Field
              id="wa-footer"
              label={t("fields.footer")}
              help={t("help.footer")}
              error={state.errors.footerText}
            >
              <input
                id="wa-footer"
                name="footerText"
                type="text"
                value={state.footerText}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    field: "footerText",
                    value: e.target.value,
                  })
                }
                disabled={state.submitting}
                aria-invalid={Boolean(state.errors.footerText)}
                className={INPUT_CLASS}
              />
            </Field>

            <fieldset className="flex flex-col gap-3">
              <legend className="text-petroleum-500 mb-1 text-xs font-medium">
                {t("fields.buttons")}
              </legend>
              {state.buttons.map((button, i) => (
                <div
                  key={i}
                  className="border-sand-200 flex flex-col gap-3 rounded-xl border p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-petroleum-500 text-xs font-medium">
                      {t("form.buttonN", { n: i + 1 })}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({ type: "removeButton", index: i })
                      }
                      aria-label={t("form.removeButton")}
                      title={t("form.removeButton")}
                      disabled={state.submitting}
                      className="text-petroleum-400/50 transition-colors hover:text-red-500"
                    >
                      <IconTrash />
                    </button>
                  </div>
                  <Field
                    id={`wa-button-${i}-type`}
                    label={t("fields.buttonType")}
                  >
                    <OptionSelect<ButtonType>
                      id={`wa-button-${i}-type`}
                      value={button.type}
                      options={[
                        {
                          value: "QUICK_REPLY",
                          label: t("buttonType.QUICK_REPLY"),
                        },
                        { value: "URL", label: t("buttonType.URL") },
                      ]}
                      onChange={(value) =>
                        dispatch({
                          type: "button",
                          index: i,
                          patch: { type: value },
                        })
                      }
                      disabled={state.submitting}
                      ariaLabel={t("fields.buttonType")}
                    />
                  </Field>
                  <Field
                    id={`wa-button-${i}-text`}
                    label={t("fields.buttonText")}
                    error={state.errors[`buttons.${i}.text`]}
                  >
                    <input
                      id={`wa-button-${i}-text`}
                      name={`buttons.${i}.text`}
                      type="text"
                      value={button.text}
                      onChange={(e) =>
                        dispatch({
                          type: "button",
                          index: i,
                          patch: { text: e.target.value },
                        })
                      }
                      disabled={state.submitting}
                      aria-invalid={Boolean(state.errors[`buttons.${i}.text`])}
                      className={INPUT_CLASS}
                    />
                  </Field>
                  {button.type === "URL" && (
                    <Field
                      id={`wa-button-${i}-url`}
                      label={t("fields.buttonUrl")}
                      error={state.errors[`buttons.${i}.url`]}
                    >
                      <input
                        id={`wa-button-${i}-url`}
                        name={`buttons.${i}.url`}
                        type="url"
                        inputMode="url"
                        placeholder="https://"
                        value={button.url}
                        onChange={(e) =>
                          dispatch({
                            type: "button",
                            index: i,
                            patch: { url: e.target.value },
                          })
                        }
                        disabled={state.submitting}
                        aria-invalid={Boolean(state.errors[`buttons.${i}.url`])}
                        className={INPUT_CLASS}
                      />
                    </Field>
                  )}
                </div>
              ))}
              {state.errors.buttons && (
                <ErrorLine code={state.errors.buttons} />
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => dispatch({ type: "addButton" })}
                  disabled={
                    state.submitting || state.buttons.length >= MAX_BUTTONS
                  }
                >
                  <IconPlus />
                  {t("form.addButton")}
                </Button>
                <p className="text-petroleum-400 text-xs">
                  {t("help.buttons")}
                </p>
              </div>
            </fieldset>
          </div>

          <aside className="lg:sticky lg:top-0 lg:self-start">
            <p className="text-petroleum-500 mb-2 text-xs font-medium">
              {t("detail.preview")}
            </p>
            <TemplatePreview
              headerText={state.headerText.trim() || null}
              body={state.body || " "}
              footerText={state.footerText.trim() || null}
              buttons={state.buttons.map((b) =>
                b.type === "URL"
                  ? { type: "URL", text: b.text, url: b.url }
                  : { type: "QUICK_REPLY", text: b.text },
              )}
              examples={examples}
            />
          </aside>
        </div>

        <div className="border-sand-100 flex shrink-0 justify-end gap-3 border-t px-6 py-4">
          {asking ? (
            <DiscardBar onKeep={() => setAsking(false)} onDiscard={onClose} />
          ) : (
            <>
              <Button
                id="template-cancel-button"
                variant="ghost"
                onClick={requestClose}
                disabled={state.submitting}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={state.submitting}>
                {state.submitting
                  ? t("form.sending")
                  : configured
                    ? t("form.submit")
                    : t("form.saveDraft")}
              </Button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
