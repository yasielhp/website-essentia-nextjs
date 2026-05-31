import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { defaultOgImage } from "@/constants/metadata";
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
          ? "/es/comunidad/membresias"
          : "/community/memberships",
      languages: {
        en: "/community/memberships",
        es: "/es/comunidad/membresias",
        "x-default": "/community/memberships",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: defaultOgImage,
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
