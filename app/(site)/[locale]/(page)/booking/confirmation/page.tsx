import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConfirmationContent } from "./confirmation-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "booking.confirmation",
  });
  return {
    title: { absolute: t("heading") },
    description: t("body"),
    robots: { index: false, follow: false },
    alternates: {
      canonical:
        locale === "es" ? "/es/booking/confirmation" : "/booking/confirmation",
      languages: {
        en: "/booking/confirmation",
        es: "/es/booking/confirmation",
        "x-default": "/booking/confirmation",
      },
    },
  };
}

export default async function BookingConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <ConfirmationContent />
    </Suspense>
  );
}
