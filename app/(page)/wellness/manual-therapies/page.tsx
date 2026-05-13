import type { Metadata } from "next";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";

export const metadata: Metadata = {
  title: "Manual Therapies | Essentia Wellness",
  description:
    "Expert manual therapy sessions at Essentia to relieve tension, improve mobility, and restore your body's natural balance.",
};

export default function ManualTherapiesPage() {
  return <TreatmentSection data={treatments["manual-therapies"]} />;
}
