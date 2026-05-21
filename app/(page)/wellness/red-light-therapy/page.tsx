import type { Metadata } from "next";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
import { ServiceFaq } from "@/components/sections/service-faq";
import { serviceFaqs } from "@/data/service-faqs";
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Red Light Therapy | Essentia Wellness",
  description:
    "Photobiomodulation and red light therapy at Essentia Tenerife for cellular regeneration, recovery, and skin health.",
};

export default function RedLightTherapyPage() {
  const faqs = serviceFaqs["red-light-therapy"];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Wellness", url: "/wellness" },
          { name: "Red Light Therapy", url: "/wellness/red-light-therapy" },
        ])) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(faqs)) }}
      />
      <TreatmentSection data={treatments["red-light-therapy"]} />
      <ServiceFaq faqs={faqs} />
    </>
  );
}
