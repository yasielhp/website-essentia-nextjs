import type { Metadata } from "next";
import TreatmentSection from "@components/sections/medicine/treatment/treatment-section";
import { treatments } from "@components/sections/medicine/treatment/data";
import { ServiceFaq } from "@/components/sections/service-faq";
import { serviceFaqs } from "@/data/service-faqs";
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Hyperbaric Chambers | Essentia Medicine",
  description:
    "Hyperbaric oxygen therapy at Essentia Tenerife. Accelerate recovery, reduce inflammation, and enhance cellular regeneration.",
};

export default function HyperbaricChambersPage() {
  const faqs = serviceFaqs["hyperbaric-chambers"];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Medicine", url: "/medicine" },
          { name: "Hyperbaric Chambers", url: "/medicine/hyperbaric-chambers" },
        ])) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(faqs)) }}
      />
      <TreatmentSection data={treatments["hyperbaric-chambers"]} />
      <ServiceFaq faqs={faqs} />
    </>
  );
}
