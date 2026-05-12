import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manual Therapies | Essentia Wellness",
  description:
    "Expert manual therapy sessions at Essentia to relieve tension, improve mobility, and restore your body's natural balance.",
};

export default function ManualTherapiesPage() {
  return (
    <section className="text-primary min-h-dvh">
      <div className="max-w-10xl mx-auto flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display xs:text-7xl text-4xl">Terapias Manuales</h1>
        <p className="text-primary/70 mt-4 text-lg">
          Técnicas manuales para aliviar tensiones y mejorar tu movilidad.
        </p>
      </div>
    </section>
  );
}
