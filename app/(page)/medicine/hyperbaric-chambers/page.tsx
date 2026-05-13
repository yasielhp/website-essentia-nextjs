import type { Metadata } from "next";
import TreatmentSection from "@components/sections/medicine/treatment/treatment-section";
import { treatments } from "@components/sections/medicine/treatment/data";

export const metadata: Metadata = {
  title: "Hyperbaric Chambers | Essentia Medicine",
  description:
    "Hyperbaric oxygen therapy at Essentia Tenerife. Accelerate recovery, reduce inflammation, and enhance cellular regeneration.",
};

export default function HyperbaricChambersPage() {
  return <TreatmentSection data={treatments["hyperbaric-chambers"]} />;
}
