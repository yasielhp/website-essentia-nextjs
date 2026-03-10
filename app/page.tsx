import BrandStatement from "./components/pages/homes/brand-statement";
import Hero from "./components/pages/homes/hero";
import OurExperiences from "./components/pages/homes/our-experiences";
import Services from "./components/pages/homes/services";

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
