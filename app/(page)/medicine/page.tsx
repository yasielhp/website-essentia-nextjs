import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Medicine | Essentia Longevity Center",
  description:
    "Advanced preventive medicine and longevity protocols at Essentia in Tenerife. Science-backed treatments designed to extend healthspan.",
};

export default function MedicinePage() {
  return (
    <section className="text-primary min-h-dvh">
      <div className="max-w-10xl mx-auto flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display xs:text-7xl text-4xl">Medicina</h1>
        <p className="text-primary/70 mt-4 text-lg">
          Medicina avanzada orientada a la prevención y la longevidad.
        </p>
      </div>
    </section>
  );
}
