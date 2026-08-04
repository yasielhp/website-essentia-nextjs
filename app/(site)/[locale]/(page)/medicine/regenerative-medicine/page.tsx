import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";
import { UNLAUNCHED_ROBOTS } from "@/constants/unlaunched";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "medicine.pages.regenerative-medicine",
  });
  return {
    robots: UNLAUNCHED_ROBOTS,
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/medicina/medicina-regenerativa"
          : "/medicine/regenerative-medicine",
      languages: {
        en: "/medicine/regenerative-medicine",
        es: "/es/medicina/medicina-regenerativa",
        "x-default": "/medicine/regenerative-medicine",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function RegenerativePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isEs = locale === "es";

  const copy = {
    heading: isEs ? "Próximamente" : "Coming Soon",
    body: isEs
      ? "Este servicio no está disponible todavía. Estamos trabajando para ofrecerte la Medicina Regenerativa muy pronto."
      : "This service is not available yet. We are working to bring Regenerative Medicine to you very soon.",
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
