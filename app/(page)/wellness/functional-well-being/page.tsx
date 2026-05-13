import type { Metadata } from "next";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";

export const metadata: Metadata = {
  title: "Functional Well-being | Essentia Wellness",
  description:
    "Functional wellness programs at Essentia designed to optimize your physical performance, health, and longevity.",
};

export default function FunctionalWellnessPage() {
  return <TreatmentSection data={treatments["functional-well-being"]} />;
}
