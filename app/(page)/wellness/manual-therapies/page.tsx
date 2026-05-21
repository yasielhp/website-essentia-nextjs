import type { Metadata } from "next";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
import { ServiceFaq } from "@/components/sections/service-faq";
import { serviceFaqs } from "@/data/service-faqs";
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Manual Therapies | Essentia Wellness",
  description:
    "Expert manual therapy sessions at Essentia to relieve tension, improve mobility, and restore your body's natural balance.",
};

export default function ManualTherapiesPage() {
  const faqs = serviceFaqs["manual-therapies"];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Wellness", url: "/wellness" },
          { name: "Manual Therapies", url: "/wellness/manual-therapies" },
        ])) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(faqs)) }}
      />
      <TreatmentSection data={treatments["manual-therapies"]} />
      <ServiceFaq faqs={faqs} />
    </>
  );
}
