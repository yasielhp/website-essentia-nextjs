import type { Metadata } from "next";
import UnsubscribeClientPage from "./unsubscribe-content";
import { setRequestLocale } from "next-intl/server";

export const metadata: Metadata = {
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
