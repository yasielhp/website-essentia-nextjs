import type { Metadata } from "next";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
import { breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contrast Therapy | Essentia Wellness",
  description:
    "Thermal contrast therapy at Essentia Tenerife — alternating hot and cold for accelerated recovery and enhanced wellbeing.",
};

export default function ContrastTherapyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: "Home", url: "/" },
              { name: "Wellness", url: "/wellness" },
              { name: "Contrast Therapy", url: "/wellness/contrast-therapy" },
            ]),
          ),
        }}
      />
      <TreatmentSection data={treatments["contrast-therapy"]} />
    </>
  );
}
