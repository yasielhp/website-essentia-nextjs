import type { Metadata } from "next";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";
import { breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Breathing Sessions | Essentia Wellness",
  description:
    "Guided breathwork sessions at Essentia to balance body and mind, reduce stress, and enhance performance.",
};

export default function BreathworkPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: "Home", url: "/" },
              { name: "Wellness", url: "/wellness" },
              { name: "Breathing Sessions", url: "/wellness/breathing-sessions" },
            ]),
          ),
        }}
      />
      <TreatmentSection data={treatments["breathing-sessions"]} />
    </>
  );
}
