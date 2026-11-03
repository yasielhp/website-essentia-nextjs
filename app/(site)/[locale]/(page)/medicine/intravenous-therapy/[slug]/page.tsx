import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ivProtocols } from "@/data/services-data";
import { ServiceDetailView } from "@components/sections/wellness/treatment/service-detail-view";
import { breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";

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
  if (!protocol) return {};

  const t = await getTranslations({ locale, namespace: "medicine.iv" });
  const cardKey = `protocols.${slug}`;
  const title = t.has(`${cardKey}.title`)
    ? t(`${cardKey}.title`)
    : protocol.title;
  const description = t.has(`${cardKey}.description`)
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
  if (!protocol) notFound();

  const t = await getTranslations("medicine.pages");

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
      />
    </>
  );
}
