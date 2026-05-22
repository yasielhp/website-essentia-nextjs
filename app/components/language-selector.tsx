"use client";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "../../i18n/navigation";

export function LanguageSelector() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = (next: string) => {
    router.replace(pathname, { locale: next });
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
