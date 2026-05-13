import type { Metadata } from "next";
import AboutSection from "@components/sections/about/about-section";

export const metadata: Metadata = {
  title: "About Essentia | Our Philosophy & Team",
  description:
    "Learn about Essentia's philosophy, our expert team, and our commitment to holistic wellness and longevity in Tenerife.",
};

export default function AboutPage() {
  return <AboutSection />;
}
