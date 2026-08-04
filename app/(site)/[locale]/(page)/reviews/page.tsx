import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import ReviewsMarquee from "@/components/sections/reviews/reviews-marquee";
import type { TestimonialItem } from "@/components/sections/home/testimonials-carousel";

type DbReview = {
  id: string;
  quote: string;
  name: string;
  age: string;
  initials: string;
  display_order: number;
};

const LIGHT_CLASSES = {
  bgColor: "bg-sand-50",
  textColor: "text-petroleum-700",
  avatarBg: "bg-petroleum-100",
  avatarText: "text-petroleum-700",
  mutedColor: "text-petroleum-400",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reviews.meta" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
    alternates: {
      canonical: locale === "es" ? "/es/testimonios" : "/reviews",
      languages: {
        en: "/reviews",
        es: "/es/testimonios",
        "x-default": "/reviews",
      },
    },

    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("reviews");

  const { data } = await insforge.database
    .from("reviews")
    .select("id, quote, name, age, initials, display_order")
    .eq("status", "published")
    .order("display_order", { ascending: true });

  const formatAge = (age: string) => {
    if (!age) return "";
    return locale === "es" ? `${age} años` : `Age ${age}`;
  };

  const items: TestimonialItem[] = ((data as DbReview[] | null) ?? []).map(
    (r) => ({
      quote: r.quote,
      name: r.name,
      age: formatAge(r.age),
      initials: r.initials,
      ...LIGHT_CLASSES,
    }),
  );

  const ctaHref = locale === "es" ? "/es/testimonios/nuevo" : "/reviews/new";

  return (
    <div className="bg-sand-100 overflow-hidden pt-32 pb-20 lg:pt-44">
      {/* Hero */}
      <div className="mx-auto mb-14 max-w-4xl px-6 lg:px-10">
        <h1 className="font-display text-petroleum-700 text-5xl leading-tight sm:text-6xl lg:text-7xl">
          {t("hero.headline")}
          <br />
          <span className="italic">{t("hero.headline2")}</span>
        </h1>
      </div>

      {/* Marquee */}
      <ReviewsMarquee items={items} />

      {/* CTA */}
      <div className="mx-auto mt-20 max-w-4xl px-6 text-center lg:px-10">
        <p className="font-display text-petroleum-700 mb-3 text-3xl sm:text-4xl">
          {t("cta.heading")}
        </p>
        <p className="text-petroleum-400 mb-8 text-base">{t("cta.body")}</p>
        <Button variant="solid" size="md" href={ctaHref}>
          {t("cta.button")}
        </Button>
      </div>
    </div>
  );
}
