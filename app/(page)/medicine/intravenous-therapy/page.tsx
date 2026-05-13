import type { Metadata } from "next";
import TreatmentSection from "@components/sections/medicine/treatment/treatment-section";
import { treatments } from "@components/sections/medicine/treatment/data";

export const metadata: Metadata = {
  title: "IV Therapy | Essentia Medicine",
  description:
    "Personalized intravenous infusion therapy for optimal nutrition and recovery at Essentia, Tenerife's premier longevity center.",
};

export default function IvTherapyPage() {
  return <TreatmentSection data={treatments["intravenous-therapy"]} />;
}
