import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ContactSection from "@components/sections/contact/contact-section";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: locale === "es" ? "/es/contact" : "/contact",
      languages: {
        "en": "/contact",
        "es": "/es/contact",
        "x-default": "/contact",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
    },
  };
}

export default function ContactPage() {
  return <ContactSection />;
}
