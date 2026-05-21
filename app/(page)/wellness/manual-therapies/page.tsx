import type { Metadata } from "next";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
import { breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Manual Therapies | Essentia Wellness",
  description:
    "Expert manual therapy sessions at Essentia to relieve tension, improve mobility, and restore your body's natural balance.",
};

export default function ManualTherapiesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: "Home", url: "/" },
              { name: "Wellness", url: "/wellness" },
              { name: "Manual Therapies", url: "/wellness/manual-therapies" },
            ]),
          ),
        }}
      />
      <TreatmentSection data={treatments["manual-therapies"]} />
    </>
  );
}
