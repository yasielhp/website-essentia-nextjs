"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { IconWorld } from "@components/ui/icons";
import { setPreferredLanguage } from "@/actions/preferred-language";

const labels: Record<string, string> = {
  en: "English",
  es: "Español",
};

export default function LanguageSelector() {
  const locale = useLocale();
  const t = useTranslations("header");
  const router = useRouter();

  /**
   * Where the other language lives, taken from the page's own `hreflang`.
   *
   * This used to be built from `usePathname()` and `useParams()`, which meant
   * subscribing the whole control to every URL change to read two values it
   * only ever uses on click. `window.location` is no substitute — the routes
   * are translated, so `/es/bienestar/terapia-de-contraste` cannot be turned
   * back into `/wellness/contrast-therapy` without next-intl's own tables.
   *
   * The page already published the answer. Every page emits
   * `<link rel="alternate" hreflang="es" …>` from its metadata, and for a blog
   * post that link carries the real Spanish slug, which the route pattern
   * never did.
   */
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;

    // Remember the choice: on the profile when there is one to write to, in
    // the cookie either way. Not awaited — the navigation should not wait on it.
    void setPreferredLanguage(next);

    const alternate = document.querySelector<HTMLLinkElement>(
      `link[rel="alternate"][hreflang="${next}"]`,
    );

    // A page with no alternate declared falls back to the front page in the
    // chosen language rather than guessing at a translated slug.
    router.replace(
      alternate
        ? new URL(alternate.href, window.location.origin).pathname
        : next === "es"
          ? "/es"
          : "/",
    );
  };

  return (
    <div className="border-petroleum-500 relative flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-sm">
      <IconWorld />
      {/* The globe carries no text, so the control needs a name of its own —
          without it a screen reader announces only the current language. */}
      <select
        aria-label={t("languageAriaLabel")}
        value={locale}
        onChange={handleChange}
        className="cursor-pointer appearance-none bg-transparent pr-4 outline-none"
      >
        {Object.entries(labels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="text-petroleum-500"
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}
