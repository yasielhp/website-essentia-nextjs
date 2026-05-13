import type { Metadata } from "next";
import EducationRegisterSection from "@components/sections/community/education-register-section";

export const metadata: Metadata = {
  title: "Reserve your seat | Education Programs | Essentia",
  description:
    "Reserve your seat for the next Essentia masterclass. Members only.",
};

export default function EducationRegisterPage() {
  return <EducationRegisterSection />;
}
