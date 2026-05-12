import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contrast Therapy | Essentia Wellness",
  description:
    "Thermal contrast therapy at Essentia Tenerife — alternating hot and cold for accelerated recovery and enhanced wellbeing.",
};

export default function ContrastTherapyPage() {
  return (
    <section className="text-primary min-h-dvh">
      <div className="max-w-10xl mx-auto flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display xs:text-7xl text-4xl">Contraste Térmico</h1>
        <p className="text-primary/70 mt-4 text-lg">
          Terapia de contraste térmico para la recuperación y el bienestar.
        </p>
      </div>
    </section>
  );
}
