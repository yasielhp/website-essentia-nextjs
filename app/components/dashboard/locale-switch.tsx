"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setPreferredLanguage } from "@/actions/preferred-language";

const LOCALES = ["en", "es"] as const;

/**
 * The dashboard has no `[locale]` segment to switch on, so the choice is
 * recorded and the tree re-rendered — `router.refresh()` re-runs the layout,
 * which reads it back and swaps the messages.
 *
 * The same choice is written to the signed-in profile, so it follows the person
 * to the public site and to their next browser.
 */
export function LocaleSwitch() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: string) {
    if (next === locale) return;
    startTransition(async () => {
      await setPreferredLanguage(next);
      router.refresh();
    });
  }

  return (
    <div className="border-sand-100 flex items-center justify-between border-b px-4 py-2.5">
      <span className="text-petroleum-400 text-xs">{t("shell.language")}</span>
      <div className="flex items-center gap-1">
        {LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            disabled={pending}
            onClick={() => switchTo(code)}
            aria-pressed={locale === code}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
              locale === code
                ? "bg-petroleum-700 text-white"
                : "text-petroleum-400 hover:bg-sand-50 hover:text-petroleum-700"
            }`}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
