import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { facialTreatments } from "@/data/services-data";
import { ServiceDetailView } from "@components/sections/wellness/treatment/service-detail-view";
import { breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { cardMeta } from "@/lib/treatments/prices";
import {
  isTreatmentHidden,
  listPublicTierPrices,
} from "@/lib/treatments/public-prices";

// The page prints the price of its session type, which the centre changes
// from the dashboard: it is rebuilt at most every five minutes so a new price
// shows without a deploy (and at once when Settings saves one). Same figure as
// `TIER_PRICES_REVALIDATE_SECONDS`; Next needs it written here as a literal.
export const revalidate = 300;

type Props = { params: Promise<{ slug: string; locale: string }> };

export async function generateStaticParams() {
  return facialTreatments.map((s) => ({ slug: s.id }));
}

/**
 * Title and description come from the translated card copy, not from
 * `facialTreatments` — that array holds English only, and taking the text
 * straight from it would serve the same title and snippet on both trees.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const facial = facialTreatments.find((s) => s.id === slug);
  // A treatment whose session type is switched off has no page while it is
  // off: no title or description of its own on the 404 either.
  if (!facial || (await isTreatmentHidden("facial-therapies", slug))) return {};

  const t = await getTranslations({ locale, namespace: "wellness.treatments" });
  const cardKey = `facialCards.${slug}`;
  const title = t.has(`${cardKey}.title`)
    ? t(`${cardKey}.title`)
    : facial.title;
  // A card's description can run past what a search result shows; where it
  // does, the card carries a shorter one written for this.
  const description = t.has(`${cardKey}.metaDescription`)
    ? t(`${cardKey}.metaDescription`)
    : t.has(`${cardKey}.description`)
      ? t(`${cardKey}.description`)
      : facial.description;

  return {
    title: { absolute: `${title} | ${t("facialMetaSuffix")}` },
    description,
    alternates: {
      canonical:
        locale === "es"
          ? `/es/bienestar/terapias-faciales/${slug}`
          : `/wellness/facial-therapies/${slug}`,
      languages: {
        en: `/wellness/facial-therapies/${slug}`,
        es: `/es/bienestar/terapias-faciales/${slug}`,
        "x-default": `/wellness/facial-therapies/${slug}`,
      },
    },
  };
}

export default async function FacialDetailPage({ params }: Props) {
  const { slug, locale } = await params;
  setRequestLocale(locale);

  const facial = facialTreatments.find((s) => s.id === slug);
  // Switched off in Settings: 404 while it is off, not a redirect. The page
  // comes back by itself when it is switched on, and a 404 tells a search
  // engine to drop it until then, where a redirect to the list would be read
  // as a soft 404 (or, permanent, be kept by browsers after it is back).
  if (!facial || (await isTreatmentHidden("facial-therapies", slug)))
    notFound();

  const t = await getTranslations("wellness.pages");
  // The same line as its card on the list, read on the server. A ritual with
  // no length of its own (its card prints a line written for it) has none
  // here: its session type is not on sale, so there is no price to show.
  const prices = await listPublicTierPrices("facial-therapies");
  const metaLine = facial.durations
    ? cardMeta(
        prices,
        facial.title,
        facial.durations,
        locale === "es" ? "es" : "en",
      )
    : "";

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: t("breadcrumbHome"), url: "/" },
          { name: t("breadcrumbWellness"), url: "/wellness" },
          {
            name: t("facial-therapies.breadcrumb"),
            url: "/wellness/facial-therapies",
          },
          {
            name: facial.title,
            url: `/wellness/facial-therapies/${facial.id}`,
          },
        ])}
      />
      <ServiceDetailView
        service={facial}
        bookingHref={`/booking?service=facial-therapies&treatment=${facial.id}`}
        backHref="/wellness/facial-therapies#treatments"
        metaLine={metaLine}
      />
    </>
  );
}
