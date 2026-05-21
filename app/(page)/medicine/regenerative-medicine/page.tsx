import type { Metadata } from "next";
import TreatmentSection from "@components/sections/medicine/treatment/treatment-section";
import { treatments } from "@components/sections/medicine/treatment/data";
import { breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Regenerative Medicine | Essentia Tenerife",
  description:
    "Cutting-edge regenerative medicine treatments to restore and optimize your health at Essentia Longevity Center, Tenerife.",
};

export default function RegenerativePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: "Home", url: "/" },
              { name: "Medicine", url: "/medicine" },
              { name: "Regenerative Medicine", url: "/medicine/regenerative-medicine" },
            ]),
          ),
        }}
      />
      <TreatmentSection data={treatments["regenerative-medicine"]} />
    </>
  );
}
