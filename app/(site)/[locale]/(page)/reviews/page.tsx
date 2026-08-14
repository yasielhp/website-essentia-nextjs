import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getOgImage } from "@/constants/metadata";
import ReviewsMarquee from "@/components/sections/reviews/reviews-marquee";
import { getAllGoogleReviews, writeReviewUrl } from "@/lib/google-places";

/** The same palette the home carousel hands its cards. */
const LIGHT_CLASSES = {
  bgColor: "bg-sand-50",
  textColor: "text-petroleum-700",
  avatarBg: "bg-petroleum-100",
  avatarText: "text-petroleum-700",
  mutedColor: "text-petroleum-400",
};

/** Drawn only for a reviewer with no picture on their Google account. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return (parts[0]![0] ?? "").toUpperCase();
  return (
    (parts[0]![0] ?? "").toUpperCase() +
    (parts[parts.length - 1]![0] ?? "").toUpperCase()
  );
}

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

/** The average, as five glyphs. The figure is spelled out beside it. */
function Stars({ rating }: { rating: number }) {
  return (
    <span aria-hidden="true" className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-4 w-4" fill="none">
          <path
            d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.6 7.7l5.8-.8L10 1.6z"
            className={
              i < Math.round(rating)
                ? "fill-petroleum-500"
                : "fill-petroleum-500/20"
            }
          />
        </svg>
      ))}
    </span>
  );
}

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, place] = await Promise.all([
    getTranslations("reviews"),
    getAllGoogleReviews(locale === "es" ? "es" : "en"),
  ]);

  const writeUrl = writeReviewUrl();

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
    <main className="bg-sand-100 overflow-hidden">
      <div className="flex flex-col gap-14 pt-32 pb-24 md:pt-44">
        <header className="mx-auto flex max-w-4xl flex-col items-center gap-5 px-5 text-center">
          <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
            {t("headline")}
            <br />
            {t("headline2")}
          </h1>

          {place.rating !== null && (
            <div className="text-petroleum-500 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
              <Stars rating={place.rating} />
              <span className="text-petroleum-700 font-medium tabular-nums">
                {place.rating.toFixed(1)}
              </span>
              {place.userRatingCount && (
                <span className="text-petroleum-400">
                  {t("ratingCount", { count: place.userRatingCount })}
                </span>
              )}
            </div>
          )}
        </header>

        {/* Deliberately outside the centred container: the rows are meant to
        run off both edges of the screen. */}
        {items.length === 0 ? (
          <p className="text-petroleum-500 px-5 text-center">{t("empty")}</p>
        ) : (
          <ReviewsMarquee items={items} closeLabel={t("closeReview")} />
        )}

        <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-5 text-center">
          <h2 className="font-display text-petroleum-700 text-2xl md:text-3xl">
            {t("ctaHeadline")}
          </h2>
          <p className="text-petroleum-500">{t("ctaText")}</p>

          {/* A plain anchor rather than `Button`: `Button` renders next-intl's
          `Link`, which is for routes this site owns, and Google's is not one. */}
          {writeUrl && (
            <a
              href={writeUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-body bg-petroleum-700 hover:bg-petroleum-800 active:bg-petroleum-900 focus-visible:ring-petroleum-500 mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-transparent px-7 py-2.5 text-sm font-medium whitespace-nowrap text-white transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {t("writeReview")}
            </a>
          )}
        </section>
      </div>
    </main>
  );
}
