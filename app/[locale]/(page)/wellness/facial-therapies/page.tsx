import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
import { ServiceFaq } from "@/components/sections/service-faq";
import { serviceFaqs } from "@/data/service-faqs";
import { bookableServices } from "@/data/services-data";
import {
  breadcrumbSchema,
  faqPageSchema,
  medicalTherapySchema,
} from "@/lib/seo";
import { getOgImage } from "@/constants/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "wellness.pages.facial-therapies",
  });
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: {
      canonical:
        locale === "es"
          ? "/es/bienestar/terapias-faciales"
          : "/wellness/facial-therapies",
      languages: {
        en: "/wellness/facial-therapies",
        es: "/es/bienestar/terapias-faciales",
        "x-default": "/wellness/facial-therapies",
      },
    },
    openGraph: {
      locale: locale === "es" ? "es_ES" : "en_US",
      images: getOgImage(locale),
    },
  };
}

export default async function FacialTherapiesPage() {
  const t = await getTranslations("wellness.pages");
  const faqs = serviceFaqs["facial-therapies"];
  const service = bookableServices.find((s) => s.id === "facial-therapies");
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
                name: t("facial-therapies.breadcrumb"),
                url: "/wellness/facial-therapies",
              },
            ]),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqPageSchema(faqs)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            medicalTherapySchema({
              name: service?.title ?? "facial-therapies",
              description: service?.description ?? "",
              url: "/wellness/facial-therapies",
              category: "wellness",
            }),
          ),
        }}
      />
      <TreatmentSection data={treatments["facial-therapies"]} />
      <ServiceFaq faqs={faqs} serviceSlug="facial-therapies" />
    </>
  );
}
