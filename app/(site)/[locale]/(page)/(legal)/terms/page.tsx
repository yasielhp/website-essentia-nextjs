import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === "es";

  return {
    title: {
      absolute: isEs
        ? "Términos y Condiciones | Essentia"
        : "Terms & Conditions | Essentia",
    },
    description: isEs
      ? "Lee los términos y condiciones de Essentia para membresías, reservas y uso de nuestros servicios de longevidad y bienestar en Costa Adeje, Tenerife."
      : "Read Essentia's terms and conditions for membership, bookings, and use of our longevity and wellness services in Costa Adeje, Tenerife.",
    alternates: {
      canonical: isEs ? "/es/terms" : "/terms",
      languages: {
        en: "/terms",
        es: "/es/terms",
        "x-default": "/terms",
      },
    },
  };
}
import { TermsES } from "./content-es";
import { TermsEN } from "./content-en";

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return locale === "es" ? <TermsES /> : <TermsEN />;
}
