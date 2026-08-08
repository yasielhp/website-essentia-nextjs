import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { manualTherapyTreatments } from "@/data/services-data";
import { ServiceDetailView } from "@components/sections/wellness/treatment/service-detail-view";
import { breadcrumbSchema } from "@/lib/seo";

type Props = { params: Promise<{ slug: string; locale: string }> };

export async function generateStaticParams() {
  return manualTherapyTreatments.map((s) => ({ slug: s.id }));
}

/**
 * `manualTherapyTreatments` holds one language only, so taking the title and
 * description straight from it served the English copy on both trees — every
 * one of these pages was a duplicate of its Spanish twin, and Google saw
 * sixteen pages competing on the same title and snippet. The card copy in
 * `wellness.treatments` is already translated; this reads that instead.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const service = manualTherapyTreatments.find((s) => s.id === slug);
  if (!service) return {};

  const t = await getTranslations({ locale, namespace: "wellness.treatments" });
  const cardKey = `manualTherapiesCards.${slug}`;
  const title = t.has(`${cardKey}.title`)
    ? t(`${cardKey}.title`)
    : service.title;
  const description = t.has(`${cardKey}.description`)
    ? t(`${cardKey}.description`)
    : service.description;

  return {
    title: {
      absolute: `${title} | ${t("manualTherapyMetaSuffix")}`,
    },
    description,
    alternates: {
      canonical:
        locale === "es"
          ? `/es/bienestar/terapias-manuales/${slug}`
          : `/wellness/manual-therapies/${slug}`,
      languages: {
        en: `/wellness/manual-therapies/${slug}`,
        es: `/es/bienestar/terapias-manuales/${slug}`,
        "x-default": `/wellness/manual-therapies/${slug}`,
      },
    },
  };
}

export default async function ManualTherapyDetailPage({ params }: Props) {
  const { slug, locale } = await params;
  setRequestLocale(locale);

  const service = manualTherapyTreatments.find((s) => s.id === slug);
  if (!service) notFound();

  const t = await getTranslations("wellness.pages");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: t("breadcrumbHome"), url: "/" },
              { name: t("breadcrumbWellness"), url: "/wellness" },
              {
                name: t("manual-therapies.breadcrumb"),
                url: "/wellness/manual-therapies",
              },
              {
                name: service.title,
                url: `/wellness/manual-therapies/${service.id}`,
              },
            ]),
          ),
        }}
      />
      <ServiceDetailView
        service={service}
        bookingHref={`/booking?service=manual-therapies&treatment=${service.id}`}
        backHref="/wellness/manual-therapies#treatments"
      />
    </>
  );
}
