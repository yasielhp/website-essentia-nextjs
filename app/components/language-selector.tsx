"use client";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

export function LanguageSelector() {
  const locale = useLocale();
  const router = useRouter();

  const switchLocale = (next: string) => {
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  };

  return (
    <div className="flex items-center gap-1 text-xs font-medium">
      <button
        onClick={() => switchLocale("en")}
        className={
          locale === "en"
            ? "text-petroleum-700"
            : "text-petroleum-400 hover:text-petroleum-600 transition-colors"
        }
      >
        EN
      </button>
      <span className="text-petroleum-300">/</span>
      <button
        onClick={() => switchLocale("es")}
        className={
          locale === "es"
            ? "text-petroleum-700"
            : "text-petroleum-400 hover:text-petroleum-600 transition-colors"
        }
      >
        ES
      </button>
    </div>
  );
}
