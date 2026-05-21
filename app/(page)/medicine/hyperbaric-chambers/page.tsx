import type { Metadata } from "next";
import TreatmentSection from "@components/sections/medicine/treatment/treatment-section";
import { treatments } from "@components/sections/medicine/treatment/data";
import { breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Hyperbaric Chambers | Essentia Medicine",
  description:
    "Hyperbaric oxygen therapy at Essentia Tenerife. Accelerate recovery, reduce inflammation, and enhance cellular regeneration.",
};

export default function HyperbaricChambersPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: "Home", url: "/" },
              { name: "Medicine", url: "/medicine" },
              { name: "Hyperbaric Chambers", url: "/medicine/hyperbaric-chambers" },
            ]),
          ),
        }}
      />
      <TreatmentSection data={treatments["hyperbaric-chambers"]} />
    </>
  );
}
