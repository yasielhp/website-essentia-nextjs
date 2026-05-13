import type { Metadata } from "next";
import EducationSection from "@components/sections/community/education-section";

export const metadata: Metadata = {
  title: "Education Programs | Essentia Community",
  description:
    "Monthly masterclasses with leading researchers, clinicians, and practitioners. Science you can use, delivered in person.",
};

export default function EducationPage() {
  return <EducationSection />;
}
