import type { Metadata } from "next";
import TreatmentSection from "@components/sections/wellness/treatment/treatment-section";
import { treatments } from "@components/sections/wellness/treatment/data";

export const metadata: Metadata = {
  title: "Red Light Therapy | Essentia Wellness",
  description:
    "Photobiomodulation and red light therapy at Essentia Tenerife for cellular regeneration, recovery, and skin health.",
};

export default function RedLightTherapyPage() {
  return <TreatmentSection data={treatments["red-light-therapy"]} />;
}
