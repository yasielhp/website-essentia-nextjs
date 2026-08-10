import type { Metadata } from "next";
import UnsubscribeClientPage from "./unsubscribe-content";
import { setRequestLocale } from "next-intl/server";

export const metadata: Metadata = {
  // The path is the same in both languages, but the pair is declared anyway:
  // the language selector reads these links to find where to go.
  alternates: {
    languages: {
      en: "/newsletter/unsubscribe",
      es: "/es/newsletter/unsubscribe",
      "x-default": "/newsletter/unsubscribe",
    },
  },
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <UnsubscribeClientPage />;
}
