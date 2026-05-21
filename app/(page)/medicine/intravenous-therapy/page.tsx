import type { Metadata } from "next";
import TreatmentSection from "@components/sections/medicine/treatment/treatment-section";
import { treatments } from "@components/sections/medicine/treatment/data";
import { ServiceFaq } from "@/components/sections/service-faq";
import { serviceFaqs } from "@/data/service-faqs";
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "IV Therapy | Essentia Medicine",
  description:
    "Personalized intravenous infusion therapy for optimal nutrition and recovery at Essentia, Tenerife's premier longevity center.",
};

export default function IvTherapyPage() {
  const faqs = serviceFaqs["intravenous-therapy"];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Medicine", url: "/medicine" },
          { name: "IV Therapy", url: "/medicine/intravenous-therapy" },
        ])) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(faqs)) }}
      />
      <TreatmentSection data={treatments["intravenous-therapy"]} />
      <ServiceFaq faqs={faqs} />
    </>
  );
}
