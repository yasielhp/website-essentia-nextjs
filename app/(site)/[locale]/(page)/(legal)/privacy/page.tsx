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
        ? "Política de Privacidad | Essentia"
        : "Privacy Policy | Essentia",
    },
    description: isEs
      ? "Política de privacidad de Essentia: cómo recopilamos, usamos y protegemos tus datos personales conforme al RGPD y la legislación española."
      : "Essentia's privacy policy: how we collect, use, and protect your personal data in compliance with GDPR and Spanish data protection law.",
    alternates: {
      canonical: isEs ? "/es/privacy" : "/privacy",
      languages: {
        en: "/privacy",
        es: "/es/privacy",
        "x-default": "/privacy",
      },
    },
  };
}
import { PrivacyES } from "./content-es";
import { PrivacyEN } from "./content-en";

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return locale === "es" ? <PrivacyES /> : <PrivacyEN />;
}
