import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { facialTreatments } from "@/data/services-data";
import { ServiceDetailView } from "@components/sections/wellness/treatment/service-detail-view";
import { breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";

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
  if (!facial) return {};

  const t = await getTranslations({ locale, namespace: "wellness.treatments" });
  const cardKey = `facialCards.${slug}`;
  const title = t.has(`${cardKey}.title`)
    ? t(`${cardKey}.title`)
    : facial.title;
  const description = t.has(`${cardKey}.description`)
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
  if (!facial) notFound();

  const t = await getTranslations("wellness.pages");

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
      />
    </>
  );
}
