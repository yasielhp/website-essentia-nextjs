import type { Metadata } from "next";
import Hero from "@components/sections/home/hero";

export const metadata: Metadata = {
  title: "Essentia | Longevity Center & Social Wellness Club — Tenerife",
  description:
    "Essentia is a longevity center and social wellness club in Tenerife, combining regenerative medicine, wellness protocols, and an exclusive community.",
};
import BrandStatement from "@components/sections/home/brand-statement";
import Newsletter from "@components/sections/home/newsletter";

export default function Home() {
  return (
    <>
      <Hero />
      <BrandStatement />
      <Newsletter />
    </>
  );
}
