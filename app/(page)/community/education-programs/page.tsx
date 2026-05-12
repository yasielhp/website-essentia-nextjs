import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Education Programs | Essentia Community",
  description:
    "Deepen your wellness journey with Essentia's educational programs and resources on longevity, health, and performance.",
};

export default function EducationPage() {
  return (
    <section className="text-primary min-h-dvh">
      <div className="max-w-10xl mx-auto flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display xs:text-7xl text-4xl">Educación</h1>
        <p className="text-primary/70 mt-4 text-lg">
          Formación y recursos para profundizar en tu camino hacia el bienestar.
        </p>
      </div>
    </section>
  );
}
