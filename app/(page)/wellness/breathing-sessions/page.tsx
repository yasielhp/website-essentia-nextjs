import type { Metadata } from "next";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";

export const metadata: Metadata = {
  title: "Breathing Sessions | Essentia Wellness",
  description:
    "Guided breathwork sessions at Essentia to balance body and mind, reduce stress, and enhance performance.",
};

export default function BreathworkPage() {
  return <TreatmentSection data={treatments["breathing-sessions"]} />;
}
