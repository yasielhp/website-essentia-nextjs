import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "medicine.pages.hyperbaric-chambers",
  });
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/medicina/camaras-hiperbaricas"
          : "/medicine/hyperbaric-chambers",
      languages: {
        en: "/medicine/hyperbaric-chambers",
        es: "/es/medicina/camaras-hiperbaricas",
        "x-default": "/medicine/hyperbaric-chambers",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function HyperbaricChambersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEs = locale === "es";

  const copy = {
    heading: isEs ? "Próximamente" : "Coming Soon",
    body: isEs
      ? "Este servicio no está disponible todavía. Estamos trabajando para ofrecerte las Cámaras Hiperbáricas muy pronto."
      : "This service is not available yet. We are working to bring Hyperbaric Chambers to you very soon.",
  };

  return (
    <section className="bg-sand-100 flex min-h-dvh items-center justify-center">
      <div className="mx-auto max-w-lg px-6 py-32 text-center">
        <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
          {copy.heading}
        </h1>
        <p className="text-petroleum-400 mt-5 text-base leading-relaxed">
          {copy.body}
        </p>
      </div>
    </section>
  );
}
