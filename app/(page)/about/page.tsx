import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Essentia | Our Philosophy & Team",
  description:
    "Learn about Essentia's philosophy, our expert team, and our commitment to holistic wellness and longevity in Tenerife.",
};

export default function AboutPage() {
  return (
    <section className="text-primary min-h-dvh">
      <div className="max-w-10xl mx-auto flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display xs:text-7xl text-4xl">About</h1>
        <p className="text-primary/70 mt-4 text-lg">
          Learn about our philosophy, our team, and our commitment to holistic
          wellness.
        </p>
      </div>
    </section>
  );
}
