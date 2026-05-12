import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Breathing Sessions | Essentia Wellness",
  description:
    "Guided breathwork sessions at Essentia to balance body and mind, reduce stress, and enhance performance.",
};

export default function BreathworkPage() {
  return (
    <section className="text-primary min-h-dvh">
      <div className="max-w-10xl mx-auto flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display xs:text-7xl text-4xl">Respiración</h1>
        <p className="text-primary/70 mt-4 text-lg">
          Técnicas de respiración consciente para equilibrar cuerpo y mente.
        </p>
      </div>
    </section>
  );
}
