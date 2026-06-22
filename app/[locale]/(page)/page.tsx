import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";
import { insforge } from "@/lib/insforge";
import Hero from "@components/sections/home/hero";
import BrandStatement from "@components/sections/home/brand-statement";
import ServicesOverview from "@components/sections/home/services-overview";
// import MembershipTeaser from "@components/sections/home/membership-teaser";
import Testimonials from "@components/sections/home/testimonials";
import TheSpace from "@components/sections/home/the-space";
import CommunitySection from "@components/sections/home/community-section";
import type { NextRace } from "@components/sections/home/community-section";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home.meta" });
  return {
    title: {
      absolute: t("title"),
    },
    description: t("description"),
    alternates: {
      canonical: locale === "es" ? "/es" : "/",
      languages: {
        en: "/",
        es: "/es",
        "x-default": "/",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function Home() {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await insforge.database
    .from("races")
    .select("id, title, description, date, location, distance_km")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1);

  const nextRace = (data as NextRace[] | null)?.[0] ?? null;

  return (
    <>
      <Hero />
      <BrandStatement />
      <ServicesOverview />
      {/* <MembershipTeaser /> */}
      <Testimonials />
      <TheSpace />
      <CommunitySection race={nextRace} />
    </>
  );
}
