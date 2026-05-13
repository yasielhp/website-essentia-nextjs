import type { Metadata } from "next";
import TreatmentSection from "@components/sections/medicine/treatment/treatment-section";
import { treatments } from "@components/sections/medicine/treatment/data";

export const metadata: Metadata = {
  title: "Regenerative Medicine | Essentia Tenerife",
  description:
    "Cutting-edge regenerative medicine treatments to restore and optimize your health at Essentia Longevity Center, Tenerife.",
};

export default function RegenerativePage() {
  return <TreatmentSection data={treatments["regenerative-medicine"]} />;
}
