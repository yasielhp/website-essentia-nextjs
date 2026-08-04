import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RequestedContent } from "./requested-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "booking.requested" });
  return {
    title: { absolute: t("heading") },
    description: t("body"),
    robots: { index: false, follow: false },
    alternates: {
      canonical:
        locale === "es" ? "/es/booking/requested" : "/booking/requested",
      languages: {
        en: "/booking/requested",
        es: "/es/booking/requested",
        "x-default": "/booking/requested",
      },
    },
  };
}

export default async function BookingRequestedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <RequestedContent />
    </Suspense>
  );
}
