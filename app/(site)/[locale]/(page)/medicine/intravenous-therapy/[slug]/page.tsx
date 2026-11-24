import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ivProtocols } from "@/data/services-data";
import { ServiceDetailView } from "@components/sections/wellness/treatment/service-detail-view";
import { breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { textWithPrice } from "@/lib/treatments/prices";
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
  return ivProtocols.map((p) => ({ slug: p.id }));
}

/**
 * Title and description come from the translated card copy rather than from
 * `ivProtocols`, which holds English only: taking the text straight from it
 * would serve the same title and snippet on both language trees.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const protocol = ivProtocols.find((p) => p.id === slug);
  // A treatment whose session type is switched off has no page while it is
  // off: no title or description of its own on the 404 either.
  if (!protocol || (await isTreatmentHidden("intravenous-therapy", slug)))
    return {};

  const t = await getTranslations({ locale, namespace: "medicine.iv" });
  const cardKey = `protocols.${slug}`;
  const title = t.has(`${cardKey}.title`)
    ? t(`${cardKey}.title`)
    : protocol.title;
  // A card's description can run past what a search result shows; where it
  // does, the card carries a shorter one written for this.
  const description = t.has(`${cardKey}.metaDescription`)
    ? t(`${cardKey}.metaDescription`)
    : t.has(`${cardKey}.description`)
      ? t(`${cardKey}.description`)
      : protocol.description;

  return {
    title: { absolute: `${title} | ${t("metaSuffix")}` },
    description,
    alternates: {
      canonical:
        locale === "es"
          ? `/es/medicina/terapia-intravenosa/${slug}`
          : `/medicine/intravenous-therapy/${slug}`,
      languages: {
        en: `/medicine/intravenous-therapy/${slug}`,
        es: `/es/medicina/terapia-intravenosa/${slug}`,
        "x-default": `/medicine/intravenous-therapy/${slug}`,
      },
    },
  };
}

export default async function IvProtocolPage({ params }: Props) {
  const { slug, locale } = await params;
  setRequestLocale(locale);

  const protocol = ivProtocols.find((p) => p.id === slug);
  // Switched off in Settings: 404 while it is off, not a redirect. The page
  // comes back by itself when it is switched on, and a 404 tells a search
  // engine to drop it until then, where a redirect to the list would be read
  // as a soft 404 (or, permanent, be kept by browsers after it is back).
  if (!protocol || (await isTreatmentHidden("intravenous-therapy", slug)))
    notFound();

  const t = await getTranslations("medicine.pages");
  // The line of its card on the list (its length, in words) and, after it,
  // the price of its session type, read on the server. A protocol says its
  // length as a range, so it is found by its name alone.
  const tIv = await getTranslations({ locale, namespace: "medicine.iv" });
  const metaKey = `protocols.${protocol.id}.meta`;
  const prices = await listPublicTierPrices("intravenous-therapy");
  const metaLine = textWithPrice(
    tIv.has(metaKey) ? tIv(metaKey) : "",
    prices,
    protocol.title,
    locale === "es" ? "es" : "en",
  );

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: t("breadcrumbHome"), url: "/" },
          { name: t("breadcrumbMedicine"), url: "/medicine" },
          {
            name: t("intravenous-therapy.breadcrumb"),
            url: "/medicine/intravenous-therapy",
          },
          {
            name: protocol.title,
            url: `/medicine/intravenous-therapy/${protocol.id}`,
          },
        ])}
      />
      <ServiceDetailView
        service={protocol}
        bookingHref={`/booking?service=intravenous-therapy&treatment=${protocol.id}`}
        backHref="/medicine/intravenous-therapy#protocols"
        metaLine={metaLine}
      />
    </>
  );
}
