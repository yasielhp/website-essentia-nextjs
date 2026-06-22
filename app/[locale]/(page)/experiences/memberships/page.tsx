import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";
import { MembershipsContent } from "./content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "memberships.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/experiencias/membresias"
          : "/experiences/memberships",
      languages: {
        en: "/experiences/memberships",
        es: "/es/experiencias/membresias",
        "x-default": "/experiences/memberships",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default function MembershipsPage() {
  return (
    <Suspense>
      <MembershipsContent />
    </Suspense>
  );
}
