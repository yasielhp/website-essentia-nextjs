import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CancelContent } from "./cancel-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "booking.cancel" });
  return {
    title: { absolute: t("confirm.heading") },
    description: t("confirm.body"),
    // Reached from a link in an email and scoped to one booking: there is
    // nothing here for a search engine to index.
    robots: { index: false, follow: false },
  };
}

export default async function BookingCancelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <CancelContent />
    </Suspense>
  );
}
