"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { editableLocales } from "@/lib/messages/editor-state";
import { messageEditHref } from "@/lib/messages/message-route";
import type { MessageKey } from "@/lib/messages/catalog";

/**
 * Which language of a message is being edited, and the way to the other one.
 * Each option is the link to that language's own page (the address does not
 * change shape), so a change of language goes through the same question about
 * unsaved changes as any other link, and each language keeps its own draft. A
 * message sent in one language only (the reminder) has nothing to choose.
 */
export function LanguageSwitch({
  channel,
  messageKey,
  locale,
}: {
  channel: "email" | "whatsapp";
  messageKey: MessageKey;
  locale: "es" | "en";
}) {
  const t = useTranslations("dashboard.messages.email");
  // A WhatsApp notice needs its own template in each language.
  const locales =
    channel === "whatsapp"
      ? (["es", "en"] as const)
      : editableLocales(messageKey);
  if (locales.length < 2) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <p
        id="message-language-label"
        className="text-petroleum-500 text-xs font-medium"
      >
        {t("languageSwitch.label")}
      </p>
      <nav
        aria-labelledby="message-language-label"
        className="bg-sand-100 flex w-fit rounded-full p-0.5 text-sm"
      >
        {locales.map((option) => {
          const active = option === locale;
          return (
            <Link
              key={option}
              href={messageEditHref(channel, messageKey, option)}
              aria-current={active ? "page" : undefined}
              className={`focus-visible:ring-petroleum-500 inline-flex min-h-11 items-center rounded-full px-5 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none sm:min-h-8 sm:px-4 ${
                active
                  ? "text-petroleum-700 bg-white shadow-sm"
                  : "text-petroleum-400 hover:text-petroleum-700"
              }`}
            >
              {t(`locales.${option}`)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
