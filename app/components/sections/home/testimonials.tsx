import { getTranslations, getLocale } from "next-intl/server";
import { getGoogleReviews } from "@/lib/google-places";
import TestimonialsCarousel from "./testimonials-carousel";

const LIGHT_CLASSES = {
  bgColor: "bg-sand-50",
  textColor: "text-petroleum-700",
  avatarBg: "bg-petroleum-100",
  avatarText: "text-petroleum-700",
  mutedColor: "text-petroleum-400",
};

/** Fallback for the reviewers who have no picture on their Google account. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return (parts[0]![0] ?? "").toUpperCase();
  return (
    (parts[0]![0] ?? "").toUpperCase() +
    (parts[parts.length - 1]![0] ?? "").toUpperCase()
  );
}

export default async function Testimonials() {
  const locale = await getLocale();

  // The Google call reads neither the translations nor the locale it was given,
  // so the two are in flight together rather than one waiting on the other.
  const [t, place] = await Promise.all([
    getTranslations("home.testimonials"),
    getGoogleReviews(locale === "es" ? "es" : "en"),
  ]);

  // Nothing to show means no section at all — a headline over an empty rail
  // reads as a broken page, and this is exactly what happens when the key is
  // missing or Google is unreachable.
  if (place.reviews.length === 0) return null;

  const items = place.reviews.map((review) => ({
    id: review.id,
    quote: review.text,
    name: review.authorName,
    when: review.publishedRelative,
    photoUrl: review.authorPhotoUrl,
    profileUrl: review.authorProfileUrl,
    initials: initialsOf(review.authorName),
    profileLabel: t("profileLink", { name: review.authorName }),
    ...LIGHT_CLASSES,
  }));

  return (
    <TestimonialsCarousel
      items={items}
      headline={t("headline")}
      headline2={t("headline2")}
      rating={place.rating}
      ratingCountLabel={
        place.userRatingCount
          ? t("ratingCount", { count: place.userRatingCount })
          : null
      }
      viewAllLabel={t("viewAll")}
    />
  );
}
