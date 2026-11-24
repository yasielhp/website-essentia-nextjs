import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";
import { UNLAUNCHED_ROBOTS } from "@/constants/unlaunched";
import { ComingSoon } from "@components/coming-soon";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "memberships.meta" });
  return {
    robots: UNLAUNCHED_ROBOTS,
    title: { absolute: t("title") },
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

/**
 * Hidden by the owner on 2026-11-24 until memberships are launched: the same
 * "Coming soon" as every other section that is not open, with no plan, price
 * or checkout. It stays reachable because the membership checkout
 * (`/api/checkout/membership-session`) still sends Redsys back here; nothing
 * on the site starts that checkout any more (its only caller is the plan
 * selector of `components/sections/memberships/`, which this page no longer
 * shows and which is kept for the launch).
 */
export default async function MembershipsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isEs = locale === "es";

  return <ComingSoon isEs={isEs} title={isEs ? "Membresías" : "Memberships"} />;
}
