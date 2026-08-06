import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BookingSection from "@components/sections/booking/booking-section";
import { BookableServices } from "@components/sections/booking/bookable-services";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "booking.meta" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
    alternates: {
      canonical: locale === "es" ? "/es/reserva" : "/booking",
      languages: {
        en: "/booking",
        es: "/es/reserva",
        "x-default": "/booking",
      },
    },
  };
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <BookingSection />
      <BookableServices />
    </>
  );
}
