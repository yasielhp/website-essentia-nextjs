import { getTranslations } from "next-intl/server";
import { insforge } from "@/lib/insforge";
import TestimonialsCarousel from "./testimonials-carousel";

type DbReview = {
  id: string;
  quote: string;
  name: string;
  age: string;
  initials: string;
  style: "dark" | "light";
  display_order: number;
};

const STYLE_CLASSES = {
  dark: {
    bgColor: "bg-petroleum-700",
    textColor: "text-sand-50",
    avatarBg: "bg-petroleum-500",
    avatarText: "text-sand-50",
    mutedColor: "text-sand-50/60",
  },
  light: {
    bgColor: "bg-sand-50",
    textColor: "text-petroleum-700",
    avatarBg: "bg-petroleum-100",
    avatarText: "text-petroleum-700",
    mutedColor: "text-petroleum-400",
  },
};

export default async function Testimonials() {
  const t = await getTranslations("home.testimonials");

  const { data } = await insforge.database
    .from("reviews")
    .select("id, quote, name, age, initials, style, display_order")
    .eq("status", "published")
    .order("display_order", { ascending: true });

  const items = ((data as DbReview[] | null) ?? []).map((r) => ({
    quote: r.quote,
    name: r.name,
    age: r.age,
    initials: r.initials,
    ...STYLE_CLASSES[r.style],
  }));

  return (
    <TestimonialsCarousel
      items={items}
      headline={t("headline")}
      headline2={t("headline2")}
    />
  );
}
