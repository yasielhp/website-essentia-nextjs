import type { Metadata } from "next";
import TreatmentSection from "@components/sections/medicine/treatment/treatment-section";
import { treatments } from "@components/sections/medicine/treatment/data";
import { ServiceFaq } from "@/components/sections/service-faq";
import { serviceFaqs } from "@/data/service-faqs";
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Regenerative Medicine | Essentia Tenerife",
  description:
    "Cutting-edge regenerative medicine treatments to restore and optimize your health at Essentia Longevity Center, Tenerife.",
};

export default function RegenerativePage() {
  const faqs = serviceFaqs["regenerative-medicine"];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Medicine", url: "/medicine" },
          { name: "Regenerative Medicine", url: "/medicine/regenerative-medicine" },
        ])) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(faqs)) }}
      />
      <TreatmentSection data={treatments["regenerative-medicine"]} />
      <ServiceFaq faqs={faqs} />
    </>
  );
}
