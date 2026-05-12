import type { Metadata } from "next";
import Hero from "@components/sections/home/hero";
import BrandStatement from "@components/sections/home/brand-statement";
import ServicesOverview from "@components/sections/home/services-overview";
import MembershipTeaser from "@components/sections/home/membership-teaser";
import Testimonials from "@components/sections/home/testimonials";
import TheSpace from "@components/sections/home/the-space";
import CommunitySection from "@components/sections/home/community-section";

export const metadata: Metadata = {
  title: "Essentia | Longevity Center & Social Wellness Club — Tenerife",
  description:
    "Essentia is a longevity center and social wellness club in Tenerife, combining regenerative medicine, wellness protocols, and an exclusive community.",
};

export default function Home() {
  return (
    <>
      <Hero />
      <BrandStatement />
      <ServicesOverview />
      <MembershipTeaser />
      <Testimonials />
      <TheSpace />
      <CommunitySection />
    </>
  );
}
