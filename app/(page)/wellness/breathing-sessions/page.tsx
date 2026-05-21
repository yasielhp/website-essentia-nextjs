import type { Metadata } from "next";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
import { ServiceFaq } from "@/components/sections/service-faq";
import { serviceFaqs } from "@/data/service-faqs";
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Breathing Sessions | Essentia Wellness",
  description:
    "Guided breathwork sessions at Essentia to balance body and mind, reduce stress, and enhance performance.",
};

export default function BreathworkPage() {
  const faqs = serviceFaqs["breathing-sessions"];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Wellness", url: "/wellness" },
          { name: "Breathing Sessions", url: "/wellness/breathing-sessions" },
        ])) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(faqs)) }}
      />
      <TreatmentSection data={treatments["breathing-sessions"]} />
      <ServiceFaq faqs={faqs} />
    </>
  );
}
