import BrandStatement from "./components/sections/homes/brand-statement";
import Hero from "./components/sections/homes/hero";
import OurExperiences from "./components/sections/homes/our-experiences";
import Services from "./components/sections/homes/services";

export default function Home() {
  return (
    <>
      <Hero />
      <BrandStatement />
      <OurExperiences />
      <Services />
    </>
  );
}
