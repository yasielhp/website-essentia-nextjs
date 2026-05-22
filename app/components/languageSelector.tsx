"use client";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "../../i18n/navigation";
import { IconWorld } from "@components/ui/icons";

const labels: Record<string, string> = {
  en: "English",
  es: "Español",
};

export default function LanguageSelector() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.replace(pathname, { locale: e.target.value });
  };

  return (
    <div className="border-petroleum-500 relative flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-sm">
      <IconWorld />
      <select
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
