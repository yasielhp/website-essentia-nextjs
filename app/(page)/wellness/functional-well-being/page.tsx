import type { Metadata } from "next";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
import { ServiceFaq } from "@/components/sections/service-faq";
import { serviceFaqs } from "@/data/service-faqs";
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Functional Well-being | Essentia Wellness",
  description:
    "Functional wellness programs at Essentia designed to optimize your physical performance, health, and longevity.",
};

export default function FunctionalWellnessPage() {
  const faqs = serviceFaqs["functional-well-being"];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Wellness", url: "/wellness" },
          { name: "Functional Well-being", url: "/wellness/functional-well-being" },
        ])) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(faqs)) }}
      />
      <TreatmentSection data={treatments["functional-well-being"]} />
      <ServiceFaq faqs={faqs} />
    </>
  );
}
