import { getTranslations, getLocale } from "next-intl/server";
import { insforgePublic as insforge } from "@/lib/insforge-public";
import TestimonialsCarousel from "./testimonials-carousel";

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

export default async function Testimonials() {
  const [t, locale] = await Promise.all([
    getTranslations("home.testimonials"),
    getLocale(),
  ]);

  const { data } = await insforge.database
    .from("reviews")
    .select("id, quote, name, age, initials, display_order")
    .eq("status", "published")
    .order("display_order", { ascending: true });

  const formatAge = (age: string) => {
    if (!age) return "";
    return locale === "es" ? `${age} años` : `Age ${age}`;
  };

  const items = ((data as DbReview[] | null) ?? []).map((r) => ({
    quote: r.quote,
    name: r.name,
    age: formatAge(r.age),
    initials: r.initials,
    ...LIGHT_CLASSES,
  }));

  return (
    <TestimonialsCarousel
      items={items}
      headline={t("headline")}
      headline2={t("headline2")}
    />
  );
}
