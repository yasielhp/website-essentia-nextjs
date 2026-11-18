"use client";

import { useTranslations } from "next-intl";
import { isLinkVariable } from "@/lib/messages/editor-state";
import { variableKind } from "@/lib/messages/variable-kinds";
import { KIND_TONE, KindIcon } from "./variable-kind-ui";

/**
 * The variables a message offers, as buttons that put one where the admin was
 * writing. They keep the caret where it is (a press on a button would
 * otherwise take the focus, and with it the position, away from the field).
 */
export function VariableChips({
  variables,
  disabled,
  onInsert,
}: {
  variables: readonly string[];
  disabled: boolean;
  onInsert: (name: string) => void;
}) {
  const t = useTranslations("dashboard.messages.email");
  const tEditor = useTranslations("dashboard.messages.email.editor");

  return (
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
        {variables.some(isLinkVariable) && ` ${tEditor("variablesLinkHint")}`}
      </p>
      <ul className="flex flex-wrap gap-2">
        {variables.map((name) => {
          const kind = variableKind(name);
          return (
            <li key={name}>
              <button
                type="button"
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onInsert(name)}
                className={`hover:ring-petroleum-400 focus-visible:ring-petroleum-500 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-shadow hover:ring-1 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 sm:min-h-8 ${
                  kind ? KIND_TONE[kind] : "bg-sand-100 text-petroleum-700"
                }`}
              >
                {kind && <KindIcon kind={kind} />}
                {t(`variables.${name}`)}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
