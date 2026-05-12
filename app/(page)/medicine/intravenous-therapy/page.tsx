import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IV Therapy | Essentia Medicine",
  description:
    "Personalized intravenous infusion therapy for optimal nutrition and recovery at Essentia, Tenerife's premier longevity center.",
};

export default function IvTherapyPage() {
  return (
    <section className="text-primary min-h-dvh">
      <div className="max-w-10xl mx-auto flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display xs:text-7xl text-4xl">Terapia IV</h1>
        <p className="text-primary/70 mt-4 text-lg">
          Infusiones intravenosas personalizadas para nutrición y recuperación
          óptima.
        </p>
      </div>
    </section>
  );
}
