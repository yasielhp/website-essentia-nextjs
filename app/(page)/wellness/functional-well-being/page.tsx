import type { Metadata } from "next";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
import { breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Functional Well-being | Essentia Wellness",
  description:
    "Functional wellness programs at Essentia designed to optimize your physical performance, health, and longevity.",
};

export default function FunctionalWellnessPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: "Home", url: "/" },
              { name: "Wellness", url: "/wellness" },
              { name: "Functional Well-being", url: "/wellness/functional-well-being" },
            ]),
          ),
        }}
      />
      <TreatmentSection data={treatments["functional-well-being"]} />
    </>
  );
}
